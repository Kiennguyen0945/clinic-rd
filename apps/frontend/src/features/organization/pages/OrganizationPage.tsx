import { Building2, ChevronDown, DoorOpen, MoreVertical, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'

import type { Department, Room } from '../api/organization.api'
import DepartmentModal from '../components/DepartmentModal'
import RoomModal from '../components/RoomModal'
import { useOrganizationMutations } from '../model/organization.mutations'
import { useOrganizationQuery } from '../model/organization.queries'
import '../organization.css'

function doctorName(room: Room) {
  if (!room.doctor) return 'Chưa phân công'
  return `BS. ${room.doctor.full_name.replace(/^BS\.\s*/i, '')}`
}

export default function OrganizationPage() {
  const query = useOrganizationQuery()
  const mutations = useOrganizationMutations()
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [departmentModal, setDepartmentModal] = useState<Department | 'new' | null>(null)
  const [roomModal, setRoomModal] = useState<Room | 'new' | null>(null)
  const [notice, setNotice] = useState('')
  const departments = useMemo(() => query.data?.departments || [], [query.data?.departments])
  const rooms = useMemo(() => query.data?.rooms || [], [query.data?.rooms])
  const selected = departments.find((item) => item.id === selectedId) || departments[0]
  const filteredDepartments = useMemo(() => {
    const keyword = search.trim().toLowerCase()
    return departments.filter((item) => !keyword || `${item.code} ${item.name} ${item.description || ''}`.toLowerCase().includes(keyword))
  }, [departments, search])

  const selectDepartment = (departmentId: number) => {
    setSelectedId(departmentId)
    setExpandedId((current) => current === departmentId ? null : departmentId)
  }

  const deleteDepartment = async (department: Department) => {
    if (!window.confirm(`Xóa khoa “${department.name}”?`)) return
    try {
      await mutations.deleteDepartment.mutateAsync(department.id)
      setSelectedId(null)
      setExpandedId(null)
      setNotice('Đã xóa khoa.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể xóa khoa.')
    }
  }

  const deleteRoom = async (room: Room) => {
    if (!window.confirm(`Xóa phòng “${room.room_number}”?`)) return
    try {
      await mutations.deleteRoom.mutateAsync(room.id)
      setNotice('Đã xóa phòng.')
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Không thể xóa phòng.')
    }
  }

  return (
    <div className="organization-page">
      <div className="page-header"><div><div className="page-title">Quản lý phòng khám</div><div className="page-subtitle">Quản lý khoa chuyên môn và phòng làm việc.</div></div></div>
      <div className="organization-stats">
        <article><span className="organization-stat-icon blue"><Building2 size={22} /></span><div><span>Tổng số khoa</span><strong>{departments.length}</strong><small>Khoa</small></div></article>
        <article><span className="organization-stat-icon green"><DoorOpen size={22} /></span><div><span>Tổng số phòng</span><strong>{rooms.length}</strong><small>Phòng</small></div></article>
      </div>
      {notice && <div className="organization-notice">{notice}</div>}
      {query.error && <div className="form-error">{query.error instanceof Error ? query.error.message : 'Không thể tải dữ liệu phòng khám.'}</div>}

      <div className="organization-workspace">
        <section className="organization-panel">
          <header><div><h2>Danh sách khoa</h2><span>{departments.length} khoa</span></div><button className="btn btn-primary btn-sm" onClick={() => setDepartmentModal('new')}><Plus size={15} /> Thêm khoa</button></header>
          <label className="organization-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm kiếm khoa..." /></label>
          <div className="department-list">
            {query.isLoading && <div className="organization-empty">Đang tải dữ liệu...</div>}
            {!query.isLoading && filteredDepartments.map((department) => {
              const departmentRooms = rooms.filter((room) => room.department_id === department.id)
              const expanded = expandedId === department.id
              return <div className="department-group" key={department.id}>
                <div role="button" tabIndex={0} aria-label={`Mở khoa ${department.name}`} aria-expanded={expanded} className={`department-item ${selected?.id === department.id ? 'selected' : ''}`} onClick={() => selectDepartment(department.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') selectDepartment(department.id) }}>
                  <span className="department-icon"><Building2 size={18} /></span>
                  <span className="department-copy"><strong>{department.name}</strong><small>{department.description || `Mã khoa: ${department.code}`}</small></span>
                  <span className="department-count">{departmentRooms.length} phòng</span>
                  <ChevronDown className={`department-chevron ${expanded ? 'expanded' : ''}`} size={16} />
                  <span className="department-menu" onClick={(event) => event.stopPropagation()}><button aria-label={`Sửa ${department.name}`} onClick={() => setDepartmentModal(department)}><Pencil size={14} /></button><button disabled={department.has_appointments} title={department.has_appointments ? 'Không thể xóa khoa đã có lịch hẹn' : undefined} aria-label={`Xóa ${department.name}`} onClick={() => void deleteDepartment(department)}><Trash2 size={14} /></button></span>
                </div>
                {expanded && <div className="department-rooms">
                  {departmentRooms.map((room) => <button key={room.id} type="button" onClick={() => setRoomModal(room)}><DoorOpen size={15} /><span><strong>{room.room_number}</strong><small>{doctorName(room)}</small></span></button>)}
                  {departmentRooms.length === 0 && <span className="department-rooms__empty">Khoa chưa có phòng.</span>}
                </div>}
              </div>
            })}
            {!query.isLoading && filteredDepartments.length === 0 && <div className="organization-empty">Không tìm thấy khoa.</div>}
          </div>
        </section>

        <section className="organization-panel room-panel">
          <header><div><h2>Danh sách phòng</h2><span>Tất cả khoa · {rooms.length} phòng</span></div><button className="btn btn-primary btn-sm" disabled={!selected} onClick={() => setRoomModal('new')}><Plus size={15} /> Thêm phòng</button></header>
          <div className="room-table-wrap"><table className="room-table"><thead><tr><th>Phòng</th><th>Khoa</th><th>Bác sĩ phụ trách</th><th>Mô tả</th><th>Thao tác</th></tr></thead><tbody>
            {rooms.map((room) => <tr key={room.id}><td><strong>{room.room_number}</strong></td><td>{room.department?.name || 'Chưa phân khoa'}</td><td>{doctorName(room)}</td><td>{room.description || '—'}</td><td><div className="room-actions"><button className="icon-button" aria-label={`Sửa ${room.room_number}`} onClick={() => setRoomModal(room)}><Pencil size={15} /></button><button className="icon-button danger" disabled={room.has_appointments} title={room.has_appointments ? 'Không thể xóa phòng đã có lịch hẹn' : undefined} aria-label={`Xóa ${room.room_number}`} onClick={() => void deleteRoom(room)}><Trash2 size={15} /></button><button className="icon-button" aria-label="Thao tác khác" disabled><MoreVertical size={15} /></button></div></td></tr>)}
          </tbody></table>{rooms.length === 0 && <div className="organization-empty"><DoorOpen size={30} /><strong>Chưa có phòng</strong><span>Thêm phòng đầu tiên cho phòng khám.</span></div>}</div>
        </section>
      </div>
      {departmentModal && <DepartmentModal department={departmentModal === 'new' ? undefined : departmentModal} onClose={() => setDepartmentModal(null)} onSaved={() => { setDepartmentModal(null); setNotice('Đã lưu thông tin khoa.') }} />}
      {roomModal && selected && <RoomModal room={roomModal === 'new' ? undefined : roomModal} departments={departments} selectedDepartmentId={selected.id} onClose={() => setRoomModal(null)} onSaved={() => { setRoomModal(null); setNotice('Đã lưu thông tin phòng.') }} />}
    </div>
  )
}
