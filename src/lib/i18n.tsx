import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "ta", label: "Tamil", native: "தமிழ்" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
  { code: "mr", label: "Marathi", native: "मराठी" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

const STORAGE_KEY = "elixir.language";

/** Translation keys are grouped by feature with dot notation. */
const en = {
  "nav.dashboard": "Dashboard",
  "nav.assistant": "AI Assistant",
  "nav.doctorPortal": "Doctor Portal",
  "nav.records": "Medical Records",
  "nav.profile": "Medical Profile",
  "nav.hospital": "Appointments",
  "nav.explore": "Labs & Scans",
  "nav.medicines": "Medicines & Reminders",
  "nav.consent": "Consent",
  "nav.activity": "Access activity",
  "nav.firstAid": "First Aid",
  "nav.emergency": "Emergency",
  "nav.settings": "Settings",
  "nav.doctor": "Doctor dashboard",
  "nav.admin": "Admin dashboard",
  "nav.directory": "Manage directory",
  "nav.audit": "Audit logs",
  "nav.menu": "Menu",
  "nav.openMenu": "Open navigation menu",
  "nav.closeMenu": "Close navigation menu",
  "nav.groupMain": "Main",
  "nav.groupCare": "Care",
  "nav.groupPrivacy": "Privacy & account",
  "common.signOut": "Sign out",
  "common.notifications": "Notifications",
  "common.markAllRead": "Mark all read",
  "common.noNotifications": "No notifications yet.",
  "common.save": "Save",
  "common.loading": "Loading…",
  "common.empty": "Nothing here yet.",
  "settings.title": "Settings",
  "settings.subtitle": "Manage your application preferences",
  "settings.general": "General Settings",
  "settings.language": "Language",
  "settings.languageHint": "Choose the language used across ELIXIR.",
  "settings.appearance": "Appearance",
  "settings.theme": "Theme",
  "settings.themeHint": "Applies instantly and is remembered on this device.",
  "settings.light": "Light",
  "settings.dark": "Dark",
  "settings.saved": "Preferences saved",
} satisfies Record<string, string>;

export type TranslationKey = keyof typeof en;

const ta: Record<TranslationKey, string> = {
  "nav.dashboard": "முகப்பு",
  "nav.assistant": "AI உதவியாளர்",
  "nav.doctorPortal": "மருத்துவர் போர்டல்",
  "nav.records": "மருத்துவ பதிவுகள்",
  "nav.profile": "மருத்துவ சுயவிவரம்",
  "nav.hospital": "சந்திப்புகள்",
  "nav.explore": "ஆய்வகங்கள் & ஸ்கேன்",
  "nav.medicines": "மருந்துகள் & நினைவூட்டல்",
  "nav.consent": "ஒப்புதல்",
  "nav.activity": "அணுகல் செயல்பாடு",
  "nav.firstAid": "முதலுதவி",
  "nav.emergency": "அவசரம்",
  "nav.settings": "அமைப்புகள்",
  "nav.doctor": "மருத்துவர் முகப்பு",
  "nav.admin": "நிர்வாக முகப்பு",
  "nav.directory": "அடைவை நிர்வகி",
  "nav.audit": "தணிக்கை பதிவுகள்",
  "nav.menu": "பட்டியல்",
  "nav.openMenu": "வழிசெலுத்தல் பட்டியலைத் திற",
  "nav.closeMenu": "வழிசெலுத்தல் பட்டியலை மூடு",
  "nav.groupMain": "முதன்மை",
  "nav.groupCare": "பராமரிப்பு",
  "nav.groupPrivacy": "தனியுரிமை & கணக்கு",
  "common.signOut": "வெளியேறு",
  "common.notifications": "அறிவிப்புகள்",
  "common.markAllRead": "அனைத்தையும் படித்ததாக குறி",
  "common.noNotifications": "இதுவரை அறிவிப்புகள் இல்லை.",
  "common.save": "சேமி",
  "common.loading": "ஏற்றுகிறது…",
  "common.empty": "இங்கு எதுவும் இல்லை.",
  "settings.title": "அமைப்புகள்",
  "settings.subtitle": "உங்கள் பயன்பாட்டு விருப்பங்களை நிர்வகிக்கவும்",
  "settings.general": "பொது அமைப்புகள்",
  "settings.language": "மொழி",
  "settings.languageHint": "ELIXIR முழுவதும் பயன்படுத்தும் மொழியைத் தேர்ந்தெடுக்கவும்.",
  "settings.appearance": "தோற்றம்",
  "settings.theme": "தீம்",
  "settings.themeHint": "உடனடியாக பயன்படுத்தப்படும், இந்த சாதனத்தில் நினைவில் வைக்கப்படும்.",
  "settings.light": "வெளிச்சம்",
  "settings.dark": "இருள்",
  "settings.saved": "விருப்பங்கள் சேமிக்கப்பட்டன",
};

const hi: Record<TranslationKey, string> = {
  "nav.dashboard": "डैशबोर्ड",
  "nav.assistant": "AI सहायक",
  "nav.doctorPortal": "डॉक्टर पोर्टल",
  "nav.records": "मेडिकल रिकॉर्ड",
  "nav.profile": "मेडिकल प्रोफ़ाइल",
  "nav.hospital": "अपॉइंटमेंट",
  "nav.explore": "लैब और स्कैन",
  "nav.medicines": "दवाइयाँ और रिमाइंडर",
  "nav.consent": "सहमति",
  "nav.activity": "एक्सेस गतिविधि",
  "nav.firstAid": "प्राथमिक उपचार",
  "nav.emergency": "आपातकाल",
  "nav.settings": "सेटिंग्स",
  "nav.doctor": "डॉक्टर डैशबोर्ड",
  "nav.admin": "एडमिन डैशबोर्ड",
  "nav.directory": "निर्देशिका प्रबंधित करें",
  "nav.audit": "ऑडिट लॉग",
  "nav.menu": "मेन्यू",
  "nav.openMenu": "नेविगेशन मेन्यू खोलें",
  "nav.closeMenu": "नेविगेशन मेन्यू बंद करें",
  "nav.groupMain": "मुख्य",
  "nav.groupCare": "देखभाल",
  "nav.groupPrivacy": "गोपनीयता और खाता",
  "common.signOut": "साइन आउट",
  "common.notifications": "सूचनाएँ",
  "common.markAllRead": "सभी पढ़ी हुई चिह्नित करें",
  "common.noNotifications": "अभी कोई सूचना नहीं।",
  "common.save": "सहेजें",
  "common.loading": "लोड हो रहा है…",
  "common.empty": "यहाँ अभी कुछ नहीं है।",
  "settings.title": "सेटिंग्स",
  "settings.subtitle": "अपनी एप्लिकेशन प्राथमिकताएँ प्रबंधित करें",
  "settings.general": "सामान्य सेटिंग्स",
  "settings.language": "भाषा",
  "settings.languageHint": "ELIXIR में उपयोग होने वाली भाषा चुनें।",
  "settings.appearance": "रूप",
  "settings.theme": "थीम",
  "settings.themeHint": "तुरंत लागू होता है और इस डिवाइस पर याद रखा जाता है।",
  "settings.light": "लाइट",
  "settings.dark": "डार्क",
  "settings.saved": "प्राथमिकताएँ सहेजी गईं",
};

const mr: Record<TranslationKey, string> = {
  "nav.dashboard": "डॅशबोर्ड",
  "nav.assistant": "AI सहाय्यक",
  "nav.doctorPortal": "डॉक्टर पोर्टल",
  "nav.records": "वैद्यकीय नोंदी",
  "nav.profile": "वैद्यकीय प्रोफाइल",
  "nav.hospital": "अपॉइंटमेंट",
  "nav.explore": "लॅब आणि स्कॅन",
  "nav.medicines": "औषधे आणि स्मरणपत्रे",
  "nav.consent": "संमती",
  "nav.activity": "प्रवेश हालचाल",
  "nav.firstAid": "प्रथमोपचार",
  "nav.emergency": "आणीबाणी",
  "nav.settings": "सेटिंग्ज",
  "nav.doctor": "डॉक्टर डॅशबोर्ड",
  "nav.admin": "अ‍ॅडमिन डॅशबोर्ड",
  "nav.directory": "निर्देशिका व्यवस्थापित करा",
  "nav.audit": "ऑडिट लॉग",
  "nav.menu": "मेनू",
  "nav.openMenu": "नेव्हिगेशन मेनू उघडा",
  "nav.closeMenu": "नेव्हिगेशन मेनू बंद करा",
  "nav.groupMain": "मुख्य",
  "nav.groupCare": "काळजी",
  "nav.groupPrivacy": "गोपनीयता आणि खाते",
  "common.signOut": "साइन आउट",
  "common.notifications": "सूचना",
  "common.markAllRead": "सर्व वाचले म्हणून चिन्हांकित करा",
  "common.noNotifications": "अद्याप सूचना नाहीत.",
  "common.save": "जतन करा",
  "common.loading": "लोड होत आहे…",
  "common.empty": "इथे अजून काहीही नाही.",
  "settings.title": "सेटिंग्ज",
  "settings.subtitle": "तुमच्या अ‍ॅप्लिकेशन प्राधान्ये व्यवस्थापित करा",
  "settings.general": "सामान्य सेटिंग्ज",
  "settings.language": "भाषा",
  "settings.languageHint": "ELIXIR मध्ये वापरली जाणारी भाषा निवडा.",
  "settings.appearance": "स्वरूप",
  "settings.theme": "थीम",
  "settings.themeHint": "लगेच लागू होते आणि या डिव्हाइसवर लक्षात ठेवले जाते.",
  "settings.light": "लाइट",
  "settings.dark": "डार्क",
  "settings.saved": "प्राधान्ये जतन झाली",
};

const DICTIONARIES: Record<LanguageCode, Record<TranslationKey, string>> = { en, ta, hi, mr };

type I18nValue = {
  language: LanguageCode;
  setLanguage: (code: LanguageCode) => void;
  t: (key: TranslationKey) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>("en");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (stored && stored in DICTIONARIES) setLanguageState(stored);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    setLanguageState(code);
    window.localStorage.setItem(STORAGE_KEY, code);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => DICTIONARIES[language][key] ?? en[key] ?? key,
    [language],
  );

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;
  // Safe fallback so components render outside the provider (e.g. public routes).
  return { language: "en", setLanguage: () => {}, t: (key) => en[key] ?? key };
}
