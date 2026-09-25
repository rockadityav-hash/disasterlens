import { useMemo, useState } from 'react'
import { Check, MapPin, Search, ShieldCheck, X } from 'lucide-react'
import { useI18n } from './i18n'

export const INDIA_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
] as const

export const INDIA_UNION_TERRITORIES = [
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
] as const

type Props = {
  current: string | null
  open: boolean
  onClose: () => void
  onSelect: (state: string) => void
}

export default function StateGate({ current, open, onClose, onSelect }: Props) {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const filter = (items: readonly string[]) => items.filter(item => item.toLowerCase().includes(query.trim().toLowerCase()))
  const states = useMemo(() => filter(INDIA_STATES), [query])
  const territories = useMemo(() => filter(INDIA_UNION_TERRITORIES), [query])
  if (!open) return null

  return <div className="state-gate" role="dialog" aria-modal="true" aria-labelledby="state-gate-title">
    <div className="state-gate-card">
      {current && <button className="state-gate-close" onClick={onClose} aria-label={t('Close')}><X size={20} /></button>}
      <div className="state-gate-brand"><span><img src="/surakshasetu-mark.svg" alt="" width="30" height="30" /></span><div><strong>SurakshaSetu</strong><small>{t('Government disaster risk decision support')}</small></div></div>
      <div className="state-gate-heading">
        <p className="eyebrow">{t('Monitoring jurisdiction')}</p>
        <h1 id="state-gate-title">{t('Select the State You Want to Monitor')}</h1>
        <p>{t('Only verified or clearly labelled demonstration data for the selected state will be shown.')}</p>
      </div>
      <label className="state-search"><Search size={18} /><input autoFocus value={query} onChange={event => setQuery(event.target.value)} placeholder={t('Search states and union territories')} /></label>
      <div className="state-options">
        {states.length > 0 && <section><h2>{t('States')}</h2><div>{states.map(state => <button key={state} className={state === current ? 'selected' : ''} onClick={() => onSelect(state)}><MapPin size={15} /><span>{state}</span>{state === current && <Check size={16} />}</button>)}</div></section>}
        {territories.length > 0 && <section><h2>{t('Union territories')}</h2><div>{territories.map(state => <button key={state} className={state === current ? 'selected' : ''} onClick={() => onSelect(state)}><MapPin size={15} /><span>{state}</span>{state === current && <Check size={16} />}</button>)}</div></section>}
        {states.length === 0 && territories.length === 0 && <div className="state-no-results"><Search size={22} /><strong>{t('No state or union territory found')}</strong><span>{t('Try a different spelling.')}</span></div>}
      </div>
      <footer><ShieldCheck size={16} /><span>{t('Your selection is saved on this device and can be changed at any time.')}</span></footer>
    </div>
  </div>
}
