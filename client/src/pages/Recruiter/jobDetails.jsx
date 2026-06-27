// client/src/pages/Recruiter/JobDetails.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobApi } from '../../utils/jobApi';

const strip = (html) => (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

export default function JobDetails() {
  const { id } = useParams();
  const nav = useNavigate();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { data } = await jobApi.get(id);
      setJob(data);
    } catch {
      alert('❌ Failed to load job.');
      nav('/recruiter/my-jobs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const del = async () => {
    if (!window.confirm('Delete this job post? This cannot be undone.')) return;
    try {
      await jobApi.remove(id);
      alert('🗑️ Deleted');
      nav('/recruiter/my-jobs');
    } catch {
      alert('❌ Failed to delete');
    }
  };

  if (loading) return <p>Loading...</p>;
  if (!job) return null;

  const showLocation =
    job.workArrangement === 'Remote'
      ? job.remote?.mustReside
        ? (job.remote?.location || 'Remote (restricted)')
        : 'Remote'
      : job.jobLocation || '—';

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
        <h2 style={{ marginBottom: 8 }}>{job.title}</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => nav(`/recruiter/post-job/${job._id}`)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', cursor: 'pointer' }}>Edit</button>
          <button onClick={del} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#fee2e2', cursor: 'pointer' }}>Delete</button>
        </div>
      </div>

      <div style={{ color: '#64748b', marginBottom: 12 }}>
        {job.createdBy?.companyName || 'Company'} • {job.workArrangement} • {showLocation}
      </div>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 12 }}>
        {job.salaryVisible === 'Yes' && (
          <div>💰 {job.salaryMin?.toLocaleString()} - {job.salaryMax?.toLocaleString()} / month</div>
        )}
        <div>👥 Positions: {job.numberOfPositions}</div>
        <div>🎓 {job.qualification}</div>
        <div>📆 Deadline: {new Date(job.applicationDeadline).toLocaleDateString()}</div>
        <div>{job.isClosed ? '🔒 Closed' : '✅ Open'}</div>
      </div>

      <h3>Description</h3>
      <div
        dangerouslySetInnerHTML={{ __html: job.description }}
        style={{
            padding: 12,
            border: '1px solid #dadde5',
            borderRadius: 8,
            background: '#ffffff',
            color: '#111827',
       }}
      />
      <div style={{ marginTop: 8, color: '#4f637eff', fontSize: 12 }}>
        ({strip(job.description).length} characters)
      </div>

      <h3 style={{ marginTop: 18 }}>Skills</h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {job.skillsRequired?.map((s) => (
          <span key={s} style={{ border: '1px solid #e2e8f0', padding: '4px 10px', borderRadius: 999 }}>{s} • {job.rateSkills?.[s]}</span>
        ))}
      </div>
    </div>
  );
}
