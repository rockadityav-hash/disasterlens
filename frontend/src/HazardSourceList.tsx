import { Database, ExternalLink } from 'lucide-react'
import { sourcesForHazard } from './hazardSources'
import { useI18n } from './i18n'

export default function HazardSourceList({ hazard }: { hazard: string }) {
  const { t } = useI18n()
  return <div className="hazard-source-list">
    {sourcesForHazard(hazard).map(source => <article className="hazard-source-card" key={source.name}>
      <div className="hazard-source-icon"><Database size={16} /></div>
      <div><strong>{source.name}</strong><span>{source.agency}</span><p>{t(source.purpose)}</p><small>{t(source.access)}</small></div>
      <a href={source.url} target="_blank" rel="noreferrer" aria-label={`${t('Open official source')} ${source.name}`}><ExternalLink size={14} />{t('Open source')}</a>
    </article>)}
  </div>
}
