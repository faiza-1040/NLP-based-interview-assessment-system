// client/src/pages/Recruiter/PostJob.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { jobApi } from '../../utils/jobApi';
import Quill from 'quill';
import 'quill/dist/quill.snow.css';
import './postjob.css';

const MIN_DESC = 300; // html -> plain text for length validation
const toPlain = (html = '') =>
  String(html).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

// Sanitizes skill names for use as database keys (Mongoose Map keys cannot contain '.')
const sanitizeSkillName = (skill) => {
  return skill.trim().replace(/[.\s]/g, '_');
};

export default function PostJob() {
  const { id } = useParams();
  const nav = useNavigate();
  const [loading, setLoading] = useState(!!id);
  const [shouldHydrate, setShouldHydrate] = useState(false); // hydrate editor once after fetch

  const [jobData, setJobData] = useState({
    title: '',
    description: '', // HTML from Quill
    skillsRequired: '',
    rateSkills: {},
    careerLevel: '',
    numberOfPositions: '',
    workArrangement: '',
    jobLocation: '',
    remote: { mustReside: false, location: '' },
    qualification: '',
    experience: '',
    salaryMin: '',
    salaryMax: '',
    salaryVisible: 'Yes',
    gender: '',
    customQuestions: false,
    applicationDeadline: '',
    screeningQuestions: [],
  });

  // State for managing the current question being added/edited
  const [newQuestion, setNewQuestion] = useState('');
  const [editingIndex, setEditingIndex] = useState(null);

  // ---------- Quill setup ----------
  const editorEl = useRef(null);
  const quillRef = useRef(null);
  const quillModules = useMemo(
    () => ({
      toolbar: [
        [{ header: [1, 2, 3, false] }],
        ['bold', 'italic', 'underline', 'strike'],
        [{ list: 'ordered' }, { list: 'bullet' }],
        ['link', 'blockquote', 'code-block'],
        [{ align: [] }],
        ['clean'],
      ],
    }),
    []
  );

  // Initialize Quill AFTER loading finishes so the editor div exists
  useEffect(() => {
    if (loading) return;
    if (!editorEl.current || quillRef.current) return;

    const q = new Quill(editorEl.current, {
      theme: 'snow',
      modules: quillModules,
      placeholder: 'Describe responsibilities, tech stack, impact, culture…',
    });
    quillRef.current = q;

    // Push HTML to React state on changes
    q.on('text-change', () => {
      const html = q.root.innerHTML;
      setJobData((d) => (d.description === html ? d : { ...d, description: html }));
    });

    // Paste initial content for create mode (usually empty string)
    q.clipboard.dangerouslyPasteHTML(jobData.description || '');
  }, [loading, quillModules, jobData.description]);

  // When editing an existing job, load server data
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data: j } = await jobApi.get(id);

        // Unsanitize the keys back to display names
        const loadedRateSkills = j.rateSkills
          ? Object.fromEntries(
              Object.entries(j.rateSkills).map(([key, value]) => {
                const originalSkill =
                  j.skillsRequired.find((s) => sanitizeSkillName(s) === key) ||
                  key.replace(/_/g, ' ');
                return [originalSkill, value];
              })
            )
          : {};

        setJobData({
          title: j.title || '',
          description: j.description || '',
          skillsRequired: (j.skillsRequired || []).join(', '),
          rateSkills: loadedRateSkills,
          careerLevel: j.careerLevel || '',
          numberOfPositions:
            j.numberOfPositions != null ? String(j.numberOfPositions) : '',
          workArrangement: j.workArrangement || '',
          jobLocation: j.jobLocation || '',
          remote: {
            mustReside: !!j?.remote?.mustReside,
            location: j?.remote?.location || '',
          },
          qualification: j.qualification || '',
          experience: j.experience || '',
          salaryMin: j.salaryMin != null ? String(j.salaryMin) : '',
          salaryMax: j.salaryMax != null ? String(j.salaryMax) : '',
          salaryVisible: j.salaryVisible || 'Yes',
          gender: j.gender || '',
          customQuestions: !!j.customQuestions,
          applicationDeadline: j.applicationDeadline
            ? j.applicationDeadline.slice(0, 10)
            : '',
          screeningQuestions: j.screeningQuestions || [],
        });
        setShouldHydrate(true);
      } catch (e) {
        console.error(e);
        alert('Could not load job for editing.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // One-time paste of fetched HTML into Quill
  useEffect(() => {
    if (!shouldHydrate) return;
    if (!quillRef.current) return;
    quillRef.current.clipboard.dangerouslyPasteHTML(jobData.description || '');
    setShouldHydrate(false);
  }, [shouldHydrate, jobData.description]);

  // ---------- Custom Question Logic ----------
  const handleAddQuestion = () => {
    const qText = newQuestion.trim();
    if (qText.length < 5)
      return alert('Question must be at least 5 characters long.');

    if (editingIndex !== null) {
      // Update existing question
      const updatedQuestions = [...jobData.screeningQuestions];
      updatedQuestions[editingIndex] = qText;
      setJobData((p) => ({ ...p, screeningQuestions: updatedQuestions }));
      setEditingIndex(null);
    } else {
      // Add new question
      setJobData((p) => ({
        ...p,
        screeningQuestions: [...p.screeningQuestions, qText],
      }));
    }
    setNewQuestion('');
  };

  const handleEditQuestion = (index) => {
    setEditingIndex(index);
    setNewQuestion(jobData.screeningQuestions[index]);
  };

  const handleDeleteQuestion = (index) => {
    const updatedQuestions = jobData.screeningQuestions.filter((_, i) => i !== index);
    setJobData((p) => ({ ...p, screeningQuestions: updatedQuestions }));

    if (editingIndex === index) {
      setEditingIndex(null);
      setNewQuestion('');
    }
    if (updatedQuestions.length === 0) {
      setJobData((p) => ({ ...p, customQuestions: false }));
    }
  };

  // ---------- Form helpers ----------
  const skillOptions = jobData.skillsRequired
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const onChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name === 'customQuestions') {
      setJobData((p) => ({
        ...p,
        [name]: checked,
        screeningQuestions: checked ? p.screeningQuestions : [],
      }));
    } else if (name === 'workArrangement') {
      setJobData((p) => ({ ...p, workArrangement: value }));
    } else {
      setJobData((p) => ({
        ...p,
        [name]: type === 'checkbox' ? checked : value,
      }));
    }
  };

  const onRemoteToggle = (mustReside) => {
    setJobData((p) => ({
      ...p,
      remote: {
        ...p.remote,
        mustReside,
        location: mustReside ? p.remote.location : '',
      },
    }));
  };

  const onRemoteLocation = (e) =>
    setJobData((p) => ({
      ...p,
      remote: { ...p.remote, location: e.target.value },
    }));

  const onRateSkill = (skill, val) =>
    setJobData((p) => ({
      ...p,
      rateSkills: { ...p.rateSkills, [skill]: val },
    }));

  const canSubmit = () => {
    if (!jobData.title.trim()) return false;
    if (!jobData.careerLevel) return false;
    if (!jobData.numberOfPositions) return false;
    if (!jobData.workArrangement) return false;

    if (
      ['On-site', 'Hybrid'].includes(jobData.workArrangement) &&
      !jobData.jobLocation.trim()
    )
      return false;

    if (
      jobData.workArrangement === 'Remote' &&
      jobData.remote.mustReside &&
      !jobData.remote.location.trim()
    )
      return false;

    if (!jobData.applicationDeadline) return false;
    if (toPlain(jobData.description).length < MIN_DESC) return false;
    if (!skillOptions.length) return false;

    if (
      !skillOptions.every((s) =>
        ['Must Have', 'Nice to Have'].includes(jobData.rateSkills[s])
      )
    )
      return false;

    if (jobData.customQuestions && jobData.screeningQuestions.length === 0)
      return false;

    return true;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit()) {
      const c = toPlain(jobData.description).length;
      alert(
        `Please complete all required fields. Ensure: 
- Description is at least ${MIN_DESC} characters (now ${c}). 
- All required skills are rated. 
- Work arrangement and location fields are filled. 
- If "Add Custom Screening Questions" is checked, at least one question is added.`
      );
      return;
    }

    // Sanitize keys in rateSkills before sending to server
    const sanitizedRateSkills = Object.fromEntries(
      Object.entries(jobData.rateSkills).map(([key, value]) => [
        sanitizeSkillName(key),
        value,
      ])
    );

    const finalScreeningQuestions = jobData.customQuestions
      ? jobData.screeningQuestions.filter((q) => q.trim().length > 0)
      : [];

    const payload = {
      title: jobData.title.trim(),
      description: jobData.description.trim(),
      skillsRequired: skillOptions,
      rateSkills: sanitizedRateSkills,
      careerLevel: jobData.careerLevel,
      numberOfPositions: Number(jobData.numberOfPositions),
      workArrangement: jobData.workArrangement,
      jobLocation: ['On-site', 'Hybrid'].includes(jobData.workArrangement)
        ? jobData.jobLocation.trim()
        : '',
      remote:
        jobData.workArrangement === 'Remote'
          ? {
              mustReside: !!jobData.remote.mustReside,
              location: jobData.remote.location.trim(),
            }
          : { mustReside: false, location: '' },
      qualification: jobData.qualification,
      experience: jobData.experience,
      salaryMin: Number(jobData.salaryMin),
      salaryMax: Number(jobData.salaryMax),
      salaryVisible: jobData.salaryVisible,
      applicationDeadline: jobData.applicationDeadline,
      ...(jobData.gender ? { gender: jobData.gender } : {}),
      customQuestions: finalScreeningQuestions.length > 0,
      screeningQuestions: finalScreeningQuestions,
    };

    try {
      if (id) {
        await jobApi.update(id, payload);
        alert('✅ Job updated');
      } else {
        await jobApi.create(payload);
        alert('✅ Job posted successfully!');
      }
      nav('/recruiter/my-jobs');
    } catch (err) {
      console.error('[post job] error:', err?.response?.data || err.message);
      const data = err?.response?.data;
      const msg =
        Array.isArray(data?.errors) && data.errors.length
          ? data.errors.join('\n')
          : data?.error || data?.message || 'Failed to save job.';

      if (data?.error?.includes('Cast to Map failed')) {
        alert(
          `❌ DATABASE ERROR: ${data.error}. Check your skill names for invalid characters (like periods or spaces).`
        );
      } else {
        alert(`❌ ${msg}`);
      }
    }
  };

  if (loading) return <p>Loading...</p>;

  const descPlainLen = toPlain(jobData.description).length;
  const isEditing = editingIndex !== null;

  return (
    <div className="postjob">
      <form onSubmit={submit} className="postjob-form">
        <h2 className="postjob-title">{id ? 'Edit Job' : 'Post Job'}</h2>

        <label>Job Title</label>
        <input
          required
          type="text"
          name="title"
          placeholder="e.g., Senior React Developer"
          value={jobData.title}
          onChange={onChange}
          autoComplete="off"
        />

        <label>{`Job Description (min ${MIN_DESC} characters)`}</label>
        <div className="postjob-editor">
          <div ref={editorEl} />
        </div>
        <div
          className={`postjob-count ${
            descPlainLen < MIN_DESC ? 'bad' : 'good'
          }`}
        >
          {descPlainLen}/{MIN_DESC}+ chars
        </div>

        <label>Skills (comma-separated)</label>
        <input
          required
          name="skillsRequired"
          placeholder="React, Node.js, MongoDB"
          value={jobData.skillsRequired}
          onChange={onChange}
        />

        {skillOptions.length > 0 && (
          <div className="postjob-rate">
            <div className="rate-skills-heading">Rate skills</div>
            {skillOptions.map((skill) => (
              <div key={skill} className="postjob-rate-row">
                <span className="rate-skill-name">{skill}</span>
                <label className="rate-label">
                  <input
                    type="radio"
                    name={`rateSkill-${sanitizeSkillName(skill)}`}
                    value="Must Have"
                    checked={jobData.rateSkills[skill] === 'Must Have'}
                    onChange={() => onRateSkill(skill, 'Must Have')}
                    required
                  />
                  <span>Must Have</span>
                </label>
                <label className="rate-label">
                  <input
                    type="radio"
                    name={`rateSkill-${sanitizeSkillName(skill)}`}
                    value="Nice to Have"
                    checked={jobData.rateSkills[skill] === 'Nice to Have'}
                    onChange={() => onRateSkill(skill, 'Nice to Have')}
                    required
                  />
                  <span>Nice to Have</span>
                </label>
              </div>
            ))}
          </div>
        )}

        <label>Career Level</label>
        <select
          required
          name="careerLevel"
          value={jobData.careerLevel}
          onChange={onChange}
        >
          <option value="">Select</option>
          <option>Intern/Student</option>
          <option>Entry Level</option>
          <option>Experienced Professional</option>
          <option>Department Head</option>
          <option>Senior Management</option>
        </select>

        <label>No. of Positions</label>
        <input
          required
          type="number"
          min="1"
          name="numberOfPositions"
          placeholder="e.g., 2"
          value={jobData.numberOfPositions}
          onChange={onChange}
        />

        {/* WORK ARRANGEMENT OPTIONS */}
        <label>Work Arrangement</label>
        <div className="work-arrangement-options">
          <label
            className={`wa-option ${
              jobData.workArrangement === 'On-site' ? 'active' : ''
            }`}
          >
            <input
              type="radio"
              name="workArrangement"
              value="On-site"
              checked={jobData.workArrangement === 'On-site'}
              onChange={onChange}
            />
            <span>On-site</span>
          </label>
          <label
            className={`wa-option ${
              jobData.workArrangement === 'Hybrid' ? 'active' : ''
            }`}
          >
            <input
              type="radio"
              name="workArrangement"
              value="Hybrid"
              checked={jobData.workArrangement === 'Hybrid'}
              onChange={onChange}
            />
            <span>Hybrid</span>
          </label>
          <label
            className={`wa-option ${
              jobData.workArrangement === 'Remote' ? 'active' : ''
            }`}
          >
            <input
              type="radio"
              name="workArrangement"
              value="Remote"
              checked={jobData.workArrangement === 'Remote'}
              onChange={onChange}
            />
            <span>Remote</span>
          </label>
        </div>

        {['On-site', 'Hybrid'].includes(jobData.workArrangement) && (
          <>
            <label>Job Location (city / address)</label>
            <input
              required
              name="jobLocation"
              placeholder="e.g., Lahore, PK"
              value={jobData.jobLocation}
              onChange={onChange}
            />
          </>
        )}

        {jobData.workArrangement === 'Remote' && (
          <div className="postjob-remote">
            <div className="remote-question">
              Do you want the candidate to reside in a specific location?
              <label className="ml small-inline-label">
                <input
                  type="radio"
                  name="remoteMustReside"
                  value="yes"
                  checked={jobData.remote.mustReside === true}
                  onChange={() => onRemoteToggle(true)}
                />{' '}
                Yes
              </label>
              <label className="ml small-inline-label">
                <input
                  type="radio"
                  name="remoteMustReside"
                  value="no"
                  checked={jobData.remote.mustReside === false}
                  onChange={() => onRemoteToggle(false)}
                />{' '}
                No
              </label>
            </div>
            {jobData.remote.mustReside && (
              <>
                <label className="mt">Required residence (city/country/region)</label>
                <input
                  required
                  name="remoteLocation"
                  placeholder="e.g Pakistan"
                  value={jobData.remote.location}
                  onChange={onRemoteLocation}
                />
              </>
            )}
          </div>
        )}

        <label>Minimum Qualification</label>
        <select
          required
          name="qualification"
          value={jobData.qualification}
          onChange={onChange}
        >
          <option value="">Select</option>
          <option>Matric</option>
          <option>Intermediate</option>
          <option>Diploma</option>
          <option>Bachelors</option>
          <option>Masters</option>
          <option>MPhil</option>
          <option>PhD</option>
        </select>

        <label>Years of Experience Required</label>
        <select
          required
          name="experience"
          value={jobData.experience}
          onChange={onChange}
        >
          <option value="">Select</option>
          <option>Fresh</option>
          <option>Less than 1 Year</option>
          <option>1-2 Years</option>
          <option>3-5 Years</option>
          <option>5-10 Years</option>
          <option>10+ Years</option>
        </select>

        <div className="row2">
          <div>
            <label>Minimum Salary</label>
            <input
              required
              type="number"
              name="salaryMin"
              placeholder="e.g., 100000"
              value={jobData.salaryMin}
              onChange={onChange}
            />
          </div>
          <div>
            <label>Maximum Salary</label>
            <input
              required
              type="number"
              name="salaryMax"
              placeholder="e.g., 200000"
              value={jobData.salaryMax}
              onChange={onChange}
            />
          </div>
        </div>

        {/* SALARY VISIBILITY SWITCH */}
        <div className="salary-toggle">
          <label className="switch">
            <input
              type="checkbox"
              checked={jobData.salaryVisible === 'Yes'}
              onChange={(e) =>
                setJobData((p) => ({
                  ...p,
                  salaryVisible: e.target.checked ? 'Yes' : 'No',
                }))
              }
            />
            <span className="slider" />
          </label>
          <span className="salary-toggle-label">Show salary to candidates</span>
        </div>

        <label>Gender Preference (optional)</label>
        <select
          name="gender"
          value={jobData.gender}
          onChange={onChange}
        >
          <option value="">No Preference</option>
          <option>Male</option>
          <option>Female</option>
        </select>

        <label>Application Deadline</label>
        <input
          required
          type="date"
          name="applicationDeadline"
          value={jobData.applicationDeadline}
          onChange={onChange}
        />

        {/* --- CUSTOM SCREENING QUESTIONS FEATURE --- */}
        <label className="row custom-q-toggle">
          <input
            type="checkbox"
            name="customQuestions"
            checked={jobData.customQuestions}
            onChange={onChange}
          />
          <span>&nbsp;Add Custom Screening Questions (shown to candidates)</span>
        </label>

        {jobData.customQuestions && (
          <div className="postjob-custom-questions">
            <h4>Questions - {jobData.screeningQuestions.length}</h4>

            {/* Add/Edit Question Input */}
            <div className="custom-q-input-row">
              <input
                type="text"
                placeholder={
                  isEditing
                    ? `Editing Question #${editingIndex + 1}`
                    : 'Enter a new screening question...'
                }
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
              />
              <button
                type="button"
                onClick={handleAddQuestion}
                disabled={newQuestion.trim().length < 5}
              >
                {isEditing ? 'Save Edit' : '+ Add Question'}
              </button>
              {isEditing && (
                <button
                  type="button"
                  onClick={() => {
                    setNewQuestion('');
                    setEditingIndex(null);
                  }}
                  className="cancel-edit-btn"
                >
                  Cancel
                </button>
              )}
            </div>

            {/* List of Questions */}
            {jobData.screeningQuestions.length > 0 && (
              <div className="custom-q-list">
                {jobData.screeningQuestions.map((q, index) => (
                  <div key={index} className="custom-q-item">
                    <span>
                      {index + 1}. {q}
                    </span>
                    <div className="q-actions">
                      <button
                        type="button"
                        className="edit-btn"
                        onClick={() => handleEditQuestion(index)}
                        disabled={isEditing}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteQuestion(index)}
                        className="delete-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {jobData.screeningQuestions.length === 0 && (
              <p className="no-questions-msg">
                Click &quot;+ Add Question&quot; to include custom screening questions.
              </p>
            )}
          </div>
        )}
        {/* --- END CUSTOM SCREENING QUESTIONS FEATURE --- */}

        <div className="actions">
          <button type="submit" disabled={!canSubmit()}>
            {id ? 'Save Changes' : 'Post Job'}
          </button>
          <button
            type="button"
            onClick={() => nav('/recruiter/my-jobs')}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
