import { Filter, Search } from 'lucide-react'

import type { PatientFilters as PatientFilterValues } from '../model/patient-filter.schema'

interface PatientFiltersProps {
  filters: PatientFilterValues
  onKeywordChange: (value: string) => void
  onGenderChange: (value: PatientFilterValues['gender']) => void
  onAgeChange: (value: PatientFilterValues['age']) => void
  onLastVisitChange: (value: PatientFilterValues['lastVisit']) => void
}

export default function PatientFilters({
  filters,
  onKeywordChange,
  onGenderChange,
  onAgeChange,
  onLastVisitChange,
}: PatientFiltersProps) {
  return <section className="patient-toolbar">
    <div className="patient-search">
      <Search size={17} />
      <input value={filters.keyword} onChange={(event) => onKeywordChange(event.target.value)} placeholder="Tìm theo tên, mã bệnh nhân hoặc số điện thoại..." />
    </div>
    <select value={filters.gender} onChange={(event) => onGenderChange(event.target.value as PatientFilterValues['gender'])}>
      <option value="all">Giới tính: Tất cả</option>
      <option>Nam</option>
      <option>Nữ</option>
    </select>
    <select value={filters.age} onChange={(event) => onAgeChange(event.target.value as PatientFilterValues['age'])}>
      <option value="all">Độ tuổi: Tất cả</option>
      <option value="under30">Dưới 30 tuổi</option>
      <option value="30to40">30-40 tuổi</option>
      <option value="over40">Trên 40 tuổi</option>
    </select>
    <select value={filters.lastVisit} onChange={(event) => onLastVisitChange(event.target.value as PatientFilterValues['lastVisit'])}>
      <option value="all">Lần khám gần nhất</option>
      <option value="today">Hôm nay</option>
      <option value="older">Trước hôm nay</option>
    </select>
    <button className="btn btn-secondary filter-button"><Filter size={15} /> Bộ lọc</button>
  </section>
}
