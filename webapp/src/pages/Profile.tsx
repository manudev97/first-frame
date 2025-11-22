import './Profile.css';

function Profile() {
  return (
    <div className="profile">
      <h2>👤 Mi Perfil</h2>
      
      <div className="profile-stats">
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">IPs Registrados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0</div>
          <div className="stat-label">Puzzles Completados</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">0 $IP</div>
          <div className="stat-label">Regalías Pendientes</div>
        </div>
      </div>

      <div className="profile-section">
        <h3>Mis IPs</h3>
        <p className="empty-state">Aún no has registrado ningún IP</p>
      </div>
    </div>
  );
}

export default Profile;

