/** How the tutor teaches at each school stage (landing page). Subjects themselves come from the API. */
export const STAGES: Array<{ range: string; hi: string; en: string; dhi: string; den: string }> = [
  { range: '1–5', hi: 'प्राथमिक', en: 'Primary', dhi: 'बहुत आसान शब्द, चित्र जैसे उदाहरण और छोटी गतिविधियाँ।', den: 'Very simple words, picture-like examples and short activities.' },
  { range: '6–8', hi: 'उच्च प्राथमिक', en: 'Middle', dhi: 'उदाहरण से अवधारणा बनाना और साथ में अभ्यास।', den: 'Building concepts from examples, with guided practice.' },
  { range: '9–10', hi: 'माध्यमिक', en: 'Secondary', dhi: 'बोर्ड परीक्षा जैसी साफ़ व्याख्या और संरचित अभ्यास।', den: 'Board-style explanations and structured practice.' },
  { range: '11–12', hi: 'उच्च माध्यमिक', en: 'Senior secondary', dhi: 'गहरी समझ, विषय के अनुसार हल करने के तरीके और परीक्षा तैयारी।', den: 'Deeper concepts, subject-specific problem solving and exam preparation.' },
];

export const DISTRICTS = [
  'Bokaro', 'Chatra', 'Deoghar', 'Dhanbad', 'Dumka', 'East Singhbhum', 'Garhwa', 'Giridih', 'Godda', 'Gumla', 'Hazaribagh', 'Jamtara',
  'Khunti', 'Koderma', 'Latehar', 'Lohardaga', 'Pakur', 'Palamu', 'Ramgarh', 'Ranchi', 'Sahebganj', 'Seraikela Kharsawan', 'Simdega', 'West Singhbhum',
];
