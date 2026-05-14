export default function DepartmentManagementTab() {
  return (
    <div className="manager-placeholder-card" role="tabpanel" id="tabpanel-department" aria-labelledby="tab-department">
      {/* Büyük İkon */}
      <div className="manager-placeholder-icon manager-placeholder-icon--dept">
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      </div>

      <h2 className="manager-placeholder-title">Departman Yönetimi</h2>

      {/* Rozet */}
      <div className="manager-placeholder-badge">
        <span className="manager-placeholder-dot" />
        Yapım Aşamasında
      </div>

      <p className="manager-placeholder-sub">Modül 13.4&apos;te açılacak</p>
    </div>
  );
}
