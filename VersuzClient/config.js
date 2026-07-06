const API_URL = 'https://zany-funicular-779jwrwp74r4h447-5000.app.github.dev/api/v1';

const API_ENDPOINTS = {
  login: `${API_URL}/auth/login`,
  register: `${API_URL}/auth/register`,
  forgotPassword: `${API_URL}/auth/forgot-password`,
  resetPassword: `${API_URL}/auth/reset-password`,
  onboarding: `${API_URL}/auth/onboarding`,
  sports: `${API_URL}/sports`,
  userDashboard: `${API_URL}/dashboard/user`,
  myTeams: `${API_URL}/teams/mine`,
  createTeam: `${API_URL}/teams/create`,
  teamDetail: (id) => `${API_URL}/teams/${id}`,
  addTeamMember: `${API_URL}/teams/add-member`,
  removeTeamMember: `${API_URL}/teams/remove-member`,
  deleteTeam: (id) => `${API_URL}/teams/${id}`,
  leaveTeam: (id) => `${API_URL}/teams/${id}/leave`,
  matches: `${API_URL}/matches`
};
