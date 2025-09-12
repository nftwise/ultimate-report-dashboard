import axios from 'axios';
import { CallRailReport, CallRailCall, CallRailTrackingNumber, CallRailMetrics, TimeRange } from '@/types';

export class CallRailConnector {
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.CALLRAIL_API_KEY || process.env.CALLRAIL_API_TOKEN || '';
    this.accountId = process.env.CALLRAIL_ACCOUNT_ID || '';
    this.baseUrl = 'https://api.callrail.com/v3';
  }

  private getHeaders() {
    return {
      'Authorization': `Token token=${this.apiKey}`,
      'Content-Type': 'application/json',
    };
  }

  private formatDate(date: string): string {
    return date;
  }

  async getCallsReport(timeRange: TimeRange, accountId?: string): Promise<CallRailReport> {
    try {
      const useAccountId = accountId || this.accountId;
      
      if (!useAccountId || useAccountId === '') {
        // Return empty report if no account ID
        return {
          calls: [],
          trackingNumbers: [],
          metrics: {
            totalCalls: 0,
            answeredCalls: 0,
            missedCalls: 0,
            totalDuration: 0,
            averageDuration: 0,
            firstTimeCalls: 0,
            repeatCalls: 0,
            conversions: 0,
            conversionRate: 0,
            totalValue: 0,
            averageValue: 0,
          },
          dateRange: timeRange,
        };
      }
      
      console.log('CallRail API call with:', { useAccountId, timeRange });
      
      // Get calls data
      const callsResponse = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls.json`,
        {
          headers: this.getHeaders(),
          params: {
            start_date: this.formatDate(timeRange.startDate),
            end_date: this.formatDate(timeRange.endDate),
            per_page: 250,
            page: 1,
            fields: 'id,answered,business_phone_number,tracking_phone_number,duration,start_time,customer_phone_number,first_call,direction,source,tags,note,value,lead_status,recording,transcription',
          },
        }
      );

      const calls: CallRailCall[] = callsResponse.data.calls.map((call: any) => ({
        id: call.id,
        phoneNumber: call.business_phone_number,
        trackingNumber: call.tracking_phone_number,
        callerNumber: call.customer_phone_number,
        duration: call.duration,
        startTime: call.start_time,
        endTime: call.start_time, // end_time not available in this version
        answered: call.answered,
        firstCall: call.first_call,
        direction: call.direction,
        source: {
          name: call.source?.name || '',
          referrer: call.source?.referrer || '',
          medium: call.source?.medium || '',
          campaign: call.source?.campaign || '',
          keyword: call.source?.keyword || '',
          landing_page: call.source?.landing_page || '',
        },
        tags: call.tags || [],
        note: call.note || '',
        value: call.value || 0,
        lead_status: call.lead_status || 'unknown',
        recording_url: call.recording,
        transcription: call.transcription,
      }));

      // Get tracking numbers
      const trackingNumbersResponse = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/trackers.json`,
        {
          headers: this.getHeaders(),
          params: {
            per_page: 100,
          },
        }
      );

      // Flatten all tracking numbers from all trackers
      const trackingNumbers: CallRailTrackingNumber[] = trackingNumbersResponse.data.trackers.flatMap((tracker: any) =>
        tracker.tracking_numbers.map((number: string, index: number) => ({
          id: `${tracker.id}_${index}`,
          name: `${tracker.name} - ${number}`,
          phoneNumber: number,
          formattedNumber: number,
          status: tracker.status,
          type: tracker.type,
          assignedTo: '',
          whisperMessage: tracker.whisper_message,
          destinationNumber: tracker.destination_number,
          smsEnabled: tracker.sms_enabled || false,
          tags: [],
        }))
      );

      // Calculate metrics
      const metrics = this.calculateMetrics(calls);

      return {
        calls,
        trackingNumbers,
        metrics,
        dateRange: {
          startDate: timeRange.startDate,
          endDate: timeRange.endDate,
        },
      };

    } catch (error: any) {
      console.error('Error fetching CallRail data:', error);
      console.error('Request details:', {
        url: `${this.baseUrl}/a/${accountId || this.accountId}/calls.json`,
        params: {
          start_date: this.formatDate(timeRange.startDate),
          end_date: this.formatDate(timeRange.endDate),
          per_page: 250,
          page: 1,
        }
      });
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', error.response.data);
      }
      throw error;
    }
  }

  private calculateMetrics(calls: CallRailCall[]): CallRailMetrics {
    const totalCalls = calls.length;
    const answeredCalls = calls.filter(call => call.answered).length;
    const missedCalls = totalCalls - answeredCalls;
    const totalDuration = calls.reduce((sum, call) => sum + call.duration, 0);
    const firstTimeCalls = calls.filter(call => call.firstCall).length;
    const repeatCalls = totalCalls - firstTimeCalls;
    const conversions = calls.filter(call => call.lead_status === 'good_lead').length;
    const totalValue = calls.reduce((sum, call) => sum + call.value, 0);

    return {
      totalCalls,
      answeredCalls,
      missedCalls,
      totalDuration,
      averageDuration: totalCalls > 0 ? totalDuration / totalCalls : 0,
      firstTimeCalls,
      repeatCalls,
      conversions,
      conversionRate: totalCalls > 0 ? (conversions / totalCalls) * 100 : 0,
      totalValue,
      averageValue: conversions > 0 ? totalValue / conversions : 0,
    };
  }

  async getCallsByDay(timeRange: TimeRange, accountId?: string): Promise<any[]> {
    try {
      const useAccountId = accountId || this.accountId;
      const response = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls/timeseries.json`,
        {
          headers: this.getHeaders(),
          params: {
            start_date: this.formatDate(timeRange.startDate),
            end_date: this.formatDate(timeRange.endDate),
          },
        }
      );

      return response.data.data.map((item: any) => ({
        date: item.date,
        totalCalls: item.total_calls,
        answeredCalls: item.total_calls, // timeseries doesn't break down by answered/missed
        missedCalls: 0,
        firstTimeCalls: 0,
        totalDuration: 0,
        averageDuration: 0,
      }));

    } catch (error) {
      console.error('Error fetching CallRail calls by day:', error);
      throw error;
    }
  }

  async getCallsBySource(timeRange: TimeRange, accountId?: string): Promise<any[]> {
    try {
      const useAccountId = accountId || this.accountId;
      const response = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls.json`,
        {
          headers: this.getHeaders(),
          params: {
            start_date: this.formatDate(timeRange.startDate),
            end_date: this.formatDate(timeRange.endDate),
            per_page: 250,
            fields: 'source',
          },
        }
      );

      // Group calls by source
      const sourceGroups: { [key: string]: any } = {};
      
      response.data.calls.forEach((call: any) => {
        const sourceName = call.source?.name || 'Direct';
        if (!sourceGroups[sourceName]) {
          sourceGroups[sourceName] = {
            source: sourceName,
            medium: call.source?.medium || '',
            campaign: call.source?.campaign || '',
            totalCalls: 0,
            answeredCalls: 0,
            conversions: 0,
          };
        }
        sourceGroups[sourceName].totalCalls++;
        if (call.answered) sourceGroups[sourceName].answeredCalls++;
        if (call.lead_status === 'good_lead') sourceGroups[sourceName].conversions++;
      });

      return Object.values(sourceGroups);

    } catch (error) {
      console.error('Error fetching CallRail calls by source:', error);
      throw error;
    }
  }

  async getRecentCalls(timeRange: TimeRange, accountId?: string, limit: number = 10): Promise<any[]> {
    try {
      const useAccountId = accountId || this.accountId;
      const response = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls.json`,
        {
          headers: this.getHeaders(),
          params: {
            start_date: this.formatDate(timeRange.startDate),
            end_date: this.formatDate(timeRange.endDate),
            per_page: limit,
            sort: 'start_time',
            order: 'desc',
            fields: 'id,answered,business_phone_number,tracking_phone_number,duration,start_time,customer_phone_number,first_call,direction,source,tags,note,value,lead_status,recording,transcription',
          },
        }
      );

      return response.data.calls.map((call: any) => ({
        id: call.id,
        phoneNumber: call.business_phone_number,
        trackingNumber: call.tracking_phone_number,
        callerNumber: call.customer_phone_number,
        duration: call.duration,
        startTime: call.start_time,
        answered: call.answered,
        firstCall: call.first_call,
        direction: call.direction,
        source: call.source?.name || 'Unknown',
        leadStatus: call.lead_status || 'unknown',
        tags: call.tags || [],
        note: call.note || '',
        value: call.value || 0,
      }));

    } catch (error) {
      console.error('Error fetching recent CallRail calls:', error);
      return [];
    }
  }

  async getCallsByTrackingNumber(timeRange: TimeRange, accountId?: string): Promise<any[]> {
    try {
      const useAccountId = accountId || this.accountId;
      const response = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls.json`,
        {
          headers: this.getHeaders(),
          params: {
            start_date: this.formatDate(timeRange.startDate),
            end_date: this.formatDate(timeRange.endDate),
            per_page: 250,
            fields: 'tracking_phone_number',
          },
        }
      );

      // Group calls by tracking number
      const trackingGroups: { [key: string]: any } = {};
      
      response.data.calls.forEach((call: any) => {
        const trackingNumber = call.tracking_phone_number;
        if (!trackingGroups[trackingNumber]) {
          trackingGroups[trackingNumber] = {
            trackingNumber,
            totalCalls: 0,
            answeredCalls: 0,
            conversions: 0,
            totalDuration: 0,
          };
        }
        trackingGroups[trackingNumber].totalCalls++;
        if (call.answered) trackingGroups[trackingNumber].answeredCalls++;
        if (call.lead_status === 'good_lead') trackingGroups[trackingNumber].conversions++;
        trackingGroups[trackingNumber].totalDuration += call.duration;
      });

      return Object.values(trackingGroups).map((group: any) => ({
        ...group,
        averageDuration: group.totalCalls > 0 ? group.totalDuration / group.totalCalls : 0,
        conversionRate: group.totalCalls > 0 ? (group.conversions / group.totalCalls) * 100 : 0,
      }));

    } catch (error) {
      console.error('Error fetching CallRail calls by tracking number:', error);
      throw error;
    }
  }

  async getCallRecordings(callId: string, accountId?: string): Promise<string | null> {
    try {
      const useAccountId = accountId || this.accountId;
      const response = await axios.get(
        `${this.baseUrl}/a/${useAccountId}/calls/${callId}.json`,
        {
          headers: this.getHeaders(),
        }
      );

      return response.data.recording_url || null;

    } catch (error) {
      console.error(`Error fetching call recording for ${callId}:`, error);
      return null;
    }
  }
}