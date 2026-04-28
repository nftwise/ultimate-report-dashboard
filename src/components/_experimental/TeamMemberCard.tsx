import { User, Briefcase } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string;
  role: string;
  specialties: string[];
  avatarUrl?: string;
  serviceType: string;
  notes?: string;
}

interface TeamMemberCardProps {
  member: TeamMember;
}

const serviceTypeLabels: Record<string, string> = {
  google_ads: 'Google Ads',
  seo: 'SEO',
  local_seo: 'Local SEO',
  strategy: 'Strategy',
  development: 'Development',
  analytics: 'Analytics',
  content: 'Content',
  social_media: 'Social Media',
};

export default function TeamMemberCard({ member }: TeamMemberCardProps) {
  return (
    <div
      className="flex items-start gap-3 p-4 rounded-xl border transition-all duration-200 hover:shadow-md"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      {/* Avatar */}
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: 'linear-gradient(135deg, var(--coral), var(--accent))',
        }}
      >
        {member.avatarUrl ? (
          <img
            src={member.avatarUrl}
            alt={member.name}
            className="w-full h-full rounded-full object-cover"
          />
        ) : (
          <User className="w-6 h-6 text-white" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <h4
            className="font-bold text-sm"
            style={{ color: 'var(--text-primary)' }}
          >
            {member.name}
          </h4>
          <div
            className="px-2 py-0.5 rounded-md text-xs font-medium flex-shrink-0"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--accent)',
            }}
          >
            {serviceTypeLabels[member.serviceType] || member.serviceType}
          </div>
        </div>

        <p
          className="text-xs mb-2 flex items-center gap-1"
          style={{ color: 'var(--text-secondary)' }}
        >
          <Briefcase className="w-3 h-3" />
          {member.role}
        </p>

        {member.notes && (
          <p
            className="text-xs leading-relaxed"
            style={{ color: 'var(--text-tertiary)' }}
          >
            {member.notes}
          </p>
        )}
      </div>
    </div>
  );
}
