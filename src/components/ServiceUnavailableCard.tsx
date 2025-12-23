import { AlertCircle } from 'lucide-react';

interface ServiceUnavailableCardProps {
  serviceName: string;
  icon: string;
  description: string;
  callToAction?: string;
  colorClass?: string;
}

export function ServiceUnavailableCard({
  serviceName,
  icon,
  description,
  callToAction = "Contact us to activate this service!",
  colorClass = "from-gray-50 to-gray-100 border-gray-200"
}: ServiceUnavailableCardProps) {
  return (
    <div className={`bg-gradient-to-br ${colorClass} rounded-xl p-6 border-2`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-gray-700">{serviceName}</h3>
        <span className="text-2xl opacity-50">{icon}</span>
      </div>
      <div className="space-y-3 text-center py-6">
        <div className="w-12 h-12 mx-auto mb-3 bg-gray-200 rounded-full flex items-center justify-center">
          <AlertCircle className="w-6 h-6 text-gray-500" />
        </div>
        <p className="text-sm text-gray-600 font-medium">{description}</p>
        <p className="text-xs text-gray-500 italic">{callToAction}</p>
      </div>
    </div>
  );
}
