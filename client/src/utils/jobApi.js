
// client/src/utils/jobApi.js
import { api } from './api'; 

export const jobApi = { // <-- ENSURE 'export const' IS USED
   // ---------------------------------------------------- 
   // Recruiter-specific calls (Protected routes: /api/jobs/...) 
   // ---------------------------------------------------- 
          
   // Create job: POST /api/jobs/post 
   create: (data) => api.post('/jobs/post', data), 
          
   // Get all jobs posted by the current recruiter: GET /api/jobs/mine 
   mine: () => api.get('/jobs/mine'), 
          
   // Get job details for editing (Recruiter view): GET /api/jobs/:id 
   get: (id) => api.get(`/jobs/${id}`), 
          
   // Update job: PUT /api/jobs/:id 
   update: (id, data) => api.put(`/jobs/${id}`, data), 
          
   // Delete job: DELETE /api/jobs/:id 
   remove: (id) => api.delete(`/jobs/${id}`), 
    
   // ---------------------------------------------------- 
   // Candidate-facing call (Public route: /api/jobs) 
   // ---------------------------------------------------- 
          
   // Get list of all public/open jobs: GET /api/jobs 
   list: (params) => api.get('/jobs', { params }), 

   
   // ✅ NEW 7:39 1/15/2026
   search: (payload) => api.post('/jobs/search', payload),
};