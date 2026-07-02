export default function MeetingsList() {
  return (
    <div className="empty-state">
      <h2>No meetings yet</h2>
      <p>Paste a transcript to get started.</p>
      <button className="primary-btn" disabled>+ New Meeting</button>
    </div>
  );
}