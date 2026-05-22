// ============================================================
// Static profession list with categories
// Used for autocomplete on the profile form
// ============================================================

export interface Profession {
  label: string;
  category: string;
}

export const PROFESSIONS: Profession[] = [
  // Healthcare
  { label: 'Doctor / Physician', category: 'Healthcare' },
  { label: 'Surgeon', category: 'Healthcare' },
  { label: 'Nurse', category: 'Healthcare' },
  { label: 'Dentist', category: 'Healthcare' },
  { label: 'Pharmacist', category: 'Healthcare' },
  { label: 'Physiotherapist', category: 'Healthcare' },
  { label: 'Radiologist', category: 'Healthcare' },
  { label: 'Veterinarian', category: 'Healthcare' },
  { label: 'Paramedic', category: 'Healthcare' },
  { label: 'Medical Researcher', category: 'Healthcare' },

  // Engineering & Technology
  { label: 'Software Engineer', category: 'Technology' },
  { label: 'Data Scientist', category: 'Technology' },
  { label: 'Machine Learning Engineer', category: 'Technology' },
  { label: 'DevOps Engineer', category: 'Technology' },
  { label: 'Cybersecurity Analyst', category: 'Technology' },
  { label: 'Civil Engineer', category: 'Engineering' },
  { label: 'Mechanical Engineer', category: 'Engineering' },
  { label: 'Electrical Engineer', category: 'Engineering' },
  { label: 'Chemical Engineer', category: 'Engineering' },
  { label: 'Aerospace Engineer', category: 'Engineering' },
  { label: 'Architect', category: 'Engineering' },
  { label: 'Construction Worker', category: 'Engineering' },

  // Manual / Skilled Trades
  { label: 'Carpenter', category: 'Skilled Trades' },
  { label: 'Plumber', category: 'Skilled Trades' },
  { label: 'Electrician', category: 'Skilled Trades' },
  { label: 'Welder', category: 'Skilled Trades' },
  { label: 'Mechanic', category: 'Skilled Trades' },
  { label: 'Mason / Bricklayer', category: 'Skilled Trades' },
  { label: 'Painter', category: 'Skilled Trades' },
  { label: 'Blacksmith', category: 'Skilled Trades' },
  { label: 'Farmer / Agricultural Worker', category: 'Skilled Trades' },
  { label: 'Fisher', category: 'Skilled Trades' },
  { label: 'Miner', category: 'Skilled Trades' },

  // Education
  { label: 'Teacher / Educator', category: 'Education' },
  { label: 'University Professor', category: 'Education' },
  { label: 'School Principal', category: 'Education' },
  { label: 'Academic Researcher', category: 'Education' },
  { label: 'Librarian', category: 'Education' },

  // Business & Finance
  { label: 'Accountant', category: 'Finance' },
  { label: 'Financial Analyst', category: 'Finance' },
  { label: 'Investment Banker', category: 'Finance' },
  { label: 'Economist', category: 'Finance' },
  { label: 'Auditor', category: 'Finance' },
  { label: 'Business Manager', category: 'Business' },
  { label: 'Entrepreneur', category: 'Business' },
  { label: 'Marketing Professional', category: 'Business' },
  { label: 'Sales Representative', category: 'Business' },
  { label: 'Human Resources Manager', category: 'Business' },

  // Legal
  { label: 'Lawyer / Attorney', category: 'Legal' },
  { label: 'Judge', category: 'Legal' },
  { label: 'Paralegal', category: 'Legal' },
  { label: 'Police Officer', category: 'Legal' },
  { label: 'Military Personnel', category: 'Legal' },

  // Arts & Creative
  { label: 'Graphic Designer', category: 'Creative' },
  { label: 'Artist / Painter', category: 'Creative' },
  { label: 'Musician', category: 'Creative' },
  { label: 'Photographer', category: 'Creative' },
  { label: 'Writer / Author', category: 'Creative' },
  { label: 'Journalist', category: 'Creative' },
  { label: 'Film Director', category: 'Creative' },
  { label: 'Actor / Performer', category: 'Creative' },
  { label: 'Fashion Designer', category: 'Creative' },

  // Sports & Fitness
  { label: 'Professional Athlete', category: 'Sports' },
  { label: 'Personal Trainer / Coach', category: 'Sports' },
  { label: 'Physical Education Teacher', category: 'Sports' },

  // Hospitality & Food
  { label: 'Chef / Cook', category: 'Hospitality' },
  { label: 'Baker', category: 'Hospitality' },
  { label: 'Waiter / Waitress', category: 'Hospitality' },
  { label: 'Hotel Manager', category: 'Hospitality' },
  { label: 'Barista', category: 'Hospitality' },
  { label: 'Bartender', category: 'Hospitality' },

  // Service & Other
  { label: 'Driver / Chauffeur', category: 'Service' },
  { label: 'Cleaner / Janitor', category: 'Service' },
  { label: 'Security Guard', category: 'Service' },
  { label: 'Retail Worker', category: 'Service' },
  { label: 'Customer Service Representative', category: 'Service' },
  { label: 'Hair Stylist / Barber', category: 'Service' },
  { label: 'Tailor / Seamstress', category: 'Service' },
  { label: 'Clergy / Religious Leader', category: 'Service' },

  // Student / Not Employed
  { label: 'Student', category: 'Education' },
  { label: 'Retired', category: 'Other' },
  { label: 'Homemaker', category: 'Other' },
  { label: 'Unemployed', category: 'Other' },
  { label: 'Other', category: 'Other' },
];

export const PROFESSION_CATEGORIES = Array.from(
  new Set(PROFESSIONS.map((p) => p.category)),
);


export function searchProfessions(query: string): Profession[] {
  const q = query.toLowerCase().trim();
  if (!q) return PROFESSIONS.slice(0, 10);

  return PROFESSIONS.filter(
    (p) =>
      p.label.toLowerCase().includes(q) ||
      p.category.toLowerCase().includes(q),
  ).slice(0, 10);
}
