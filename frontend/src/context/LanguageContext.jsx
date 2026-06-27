import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '@/services/api';

const LanguageContext = createContext();

const translations = {
  English: {
    welcome: 'Welcome',
    settings: 'Settings',
    profile: 'Profile',
    projects: 'Projects',
    bookings: 'Bookings',
    analytics: 'Analytics',
    documents: 'Documents',
    brokers: 'Brokers',
    save: 'Save Changes',
    logout: 'Log out',
    theme: 'Theme',
    language: 'Language',
    notifications: 'Notifications',
    membership: 'Membership',
    current_plan: 'Current Plan',
    upgrade: 'Upgrade to',
    search: 'Search',
    overview: 'Overview',
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
    earnings: 'Earnings',
  },
  Tamil: {
    welcome: 'வரவேற்பு',
    settings: 'அமைப்புகள்',
    profile: 'சுயவிவரம்',
    projects: 'திட்டங்கள்',
    bookings: 'பதிவுகள்',
    analytics: 'பகுப்பாய்வு',
    documents: 'ஆவணங்கள்',
    brokers: 'தரகர்கள்',
    save: 'மாற்றங்களைச் சேமி',
    logout: 'வெளியேறு',
    theme: 'தீம்',
    language: 'மொழி',
    notifications: 'அறிவிப்புகள்',
    membership: 'உறுப்பினர்',
    current_plan: 'தற்போதைய திட்டம்',
    upgrade: 'மேம்படுத்து',
    search: 'தேடு',
    overview: 'கண்ணோட்டம்',
    morning: 'காலை வணக்கம்',
    afternoon: 'மதிய வணக்கம்',
    evening: 'மாலை வணக்கம்',
    earnings: 'வருவாய்',
  },
  Hindi: {
    welcome: 'स्वागत है',
    settings: 'सेटिंग्स',
    profile: 'प्रोफ़ाइल',
    projects: 'परियोजनाएं',
    bookings: 'बुकिंग',
    analytics: 'विश्लेषण',
    documents: 'दस्तावेज़',
    brokers: 'दलाल',
    save: 'बदलाव सहेजें',
    logout: 'लॉग आउट',
    theme: 'थीम',
    language: 'भाषा',
    notifications: 'सूचनाएं',
    membership: 'सदस्यता',
    current_plan: 'वर्तमान योजना',
    upgrade: 'अपग्रेड करें',
    search: 'खोजें',
    overview: 'अवलोकन',
    morning: 'सुप्रभात',
    afternoon: 'शुभ दोपहर',
    evening: 'शुभ संध्या',
    earnings: 'कमाई',
  }
};

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'English');

  const t = (key) => {
    return translations[language]?.[key] || translations['English'][key] || key;
  };

  const updateLanguage = async (newLang) => {
    setLanguage(newLang);
    localStorage.setItem('language', newLang);
    try {
      await authApi.updateLanguage(newLang);
    } catch (err) {
      console.error('Failed to save language preference', err);
    }
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage: updateLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
