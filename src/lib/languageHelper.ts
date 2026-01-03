/**
 * Helper pour gérer la langue dans les prompts IA
 */

export type Language = 'en' | 'fr' | 'es' | 'zh';

const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  zh: '中文',
};

/**
 * Ajoute l'instruction de langue au début d'un prompt système
 */
export function addLanguageInstruction(
  systemPrompt: string,
  language: Language | null | undefined
): string {
  if (!language) {
    // Par défaut, on utilise le français si aucune langue n'est spécifiée
    return `${systemPrompt}\n\nIMPORTANT: You must respond in French (Français). All your responses, including JSON content, must be in French.`;
  }

  const languageName = LANGUAGE_NAMES[language];
  
  const languageInstructions: Record<Language, string> = {
    en: `IMPORTANT: You must respond in English. All your responses, including JSON content, must be in English.`,
    fr: `IMPORTANT: You must respond in French (Français). All your responses, including JSON content, must be in French.`,
    es: `IMPORTANT: You must respond in Spanish (Español). All your responses, including JSON content, must be in Spanish.`,
    zh: `IMPORTANT: You must respond in Chinese (中文). All your responses, including JSON content, must be in Chinese.`,
  };

  return `${systemPrompt}\n\n${languageInstructions[language]}`;
}

/**
 * Récupère la langue depuis le header ou la base de données
 */
export async function getUserLanguage(
  userId: string | null | undefined,
  headerLanguage?: string | null
): Promise<Language | null> {
  // Priorité 1: Header x-language
  if (headerLanguage && ['en', 'fr', 'es', 'zh'].includes(headerLanguage)) {
    return headerLanguage as Language;
  }

  // Priorité 2: Langue de l'utilisateur en BDD
  if (userId) {
    try {
      const prisma = (await import('./prisma')).default;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { language: true },
      });
      
      if (user?.language && ['en', 'fr', 'es', 'zh'].includes(user.language)) {
        return user.language as Language;
      }
    } catch (error) {
      console.error('Error fetching user language:', error);
    }
  }

  // Par défaut: null (sera traité comme français)
  return null;
}

