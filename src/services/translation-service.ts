import Constants from 'expo-constants';
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";

/**
 * Translation service using OCR.space API for text extraction
 * and free translation services (LibreTranslate/MyMemory)
 */
class TranslationService {
  private static LIBRE_TRANSLATE_API_URL = "https://libretranslate.de/translate"; // Public instance
  private static OCR_SPACE_API_URL = "https://api.ocr.space/parse/image"; // OCR API
  private static OCR_SPACE_API_KEY = Constants.expoConfig?.extra?.OCR_SPACE_API_KEY || "";
  private static CACHE_KEY = "translation_history";

  // OCR.space accepts only specific language codes
  // Valid options: eng, spa, por, deu, fra, ita, nld, chi_sim, chi_tra, jpn, kor, rus, ara
  private static OCR_LANGUAGE_MAP: Record<string, string> = {
    en: "eng",  // English
    es: "spa",  // Spanish
    pt: "por",  // Portuguese
    de: "deu",  // German
    fr: "fra",  // French
    it: "ita",  // Italian
    zh: "chi_sim", // Chinese Simplified
    ja: "jpn",  // Japanese
    ko: "kor",  // Korean
    ru: "rus",  // Russian
    ar: "ara"   // Arabic
    // Default will be 'eng'
  };

  static async translateScreenshot(imageUri: string, targetLanguage: string, onProgress?: (status: string) => void) {
    try {
      console.log("Starting translation process...");
      onProgress?.("Starting translation process...");
      
      // Set an overall timeout for the entire process
      const timeoutPromise = new Promise<{
        original: string;
        translated: string;
        language: string;
      }>((_, reject) => {
        setTimeout(() => reject(new Error("Translation timed out after 45 seconds")), 45000);
      });
      
      // Create the actual translation process
      const translationProcess = (async () => {
        // Extract text from image using OCR.space
        let extractedText = "";
        onProgress?.("Extracting text from image...");
        
        try {
          // Add a timeout for OCR.space
          const ocrPromise = this.extractTextWithOcrSpace(imageUri, targetLanguage);
          const ocrTimeoutPromise = new Promise<string>((_, reject) => {
            setTimeout(() => reject(new Error("OCR.space timed out")), 20000);
          });
            
          extractedText = await Promise.race([ocrPromise, ocrTimeoutPromise]);
        } catch (ocrError) {
          console.error("OCR.space extraction error:", ocrError);
          onProgress?.("Text extraction failed. Try with a clearer image.");
          throw new Error("Could not extract any text from the image. Please try again with a clearer image.");
        }
        
        if (!extractedText || extractedText.trim() === "") {
          onProgress?.("No text detected in the image.");
          throw new Error("Could not extract any text from the image");
        }
        
        onProgress?.(`Text extracted! (${extractedText.length} characters) Translating...`);
        
        // Translate text using free translation services
        const translatedText = await this.translateText(extractedText, targetLanguage, onProgress);
        
        // Save to translation history
        await this.saveTranslation(extractedText, translatedText, targetLanguage);
        
        onProgress?.("Translation complete!");
        
        return {
          original: extractedText,
          translated: translatedText,
          language: targetLanguage,
        };
      })();
      
      // Race the translation process against the timeout
      return await Promise.race([translationProcess, timeoutPromise]);
    } catch (error) {
      console.error("Translation error:", error);
      onProgress?.(`Translation error: ${error.message}`);
      throw error;
    }
  }

  private static async extractTextWithOcrSpace(imageUri: string, targetLanguage?: string): Promise<string> {
    try {
      console.log("Using OCR.space API...");
      
      // Optimize image for OCR using Image Manipulator
      const optimizedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 1000 } }], // Larger width for better accuracy
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Convert image to base64
      const base64Image = await this.imageToBase64(optimizedImage.uri);
      
      // Remove data:image/jpeg;base64, prefix if present
      const base64Data = base64Image.includes('base64,') 
        ? base64Image.split('base64,')[1] 
        : base64Image;

      // TEMPORARILY: Just use English for all OCR to avoid language code issues
      // The OCR.space API seems to have issues with some language codes
      const ocrLanguage = "eng";
      
      console.log(`Using OCR language: ${ocrLanguage} (using English for all OCR to avoid API errors)`);

      // Use OCR.space API (free tier)
      const formData = new FormData();
      formData.append('apikey', this.OCR_SPACE_API_KEY);
      formData.append('base64Image', `data:image/jpeg;base64,${base64Data}`);
      formData.append('language', ocrLanguage);
      formData.append('isOverlayRequired', 'false');
      formData.append('scale', 'true');
      formData.append('detectOrientation', 'true');
      formData.append('OCREngine', '2'); // Use OCREngine 2 for better accuracy

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      try {
        const response = await fetch(this.OCR_SPACE_API_URL, {
          method: 'POST',
          body: formData,
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`OCR API error: ${response.status}`);
        }

        const data = await response.json();
        
        if (data.IsErroredOnProcessing) {
          throw new Error(`OCR processing error: ${data.ErrorMessage}`);
        }

        // Extract the parsed text from the OCR result
        const parsedText = data.ParsedResults?.[0]?.ParsedText || "";
        console.log("Text extraction completed with OCR.space");
        return parsedText;
      } catch (fetchError) {
        if (fetchError.name === 'AbortError') {
          console.error("OCR request timed out");
          return "OCR text extraction timed out. Please try with a clearer image or try again later.";
        }
        throw fetchError;
      }
    } catch (error) {
      console.error("OCR.space extraction error:", error);
      throw error;
    }
  }

  private static async translateText(
    text: string,
    targetLanguage: string,
    onProgress?: (status: string) => void
  ): Promise<string> {
    if (!text || text.trim() === "") {
      return "";
    }
    
    try {
      // If text is too long, split it into chunks to avoid query length limit
      if (text.length > 450) {
        // Split text into chunks of 450 characters (staying under the 500 limit)
        const chunks: string[] = [];
        for (let i = 0; i < text.length; i += 450) {
          chunks.push(text.substring(i, i + 450));
        }
        
        onProgress?.(`Text is long (${chunks.length} chunks). Translating in parts...`);
        
        // Translate each chunk and join results
        const results: string[] = [];
        for (let i = 0; i < chunks.length; i++) {
          onProgress?.(`Translating part ${i+1} of ${chunks.length}...`);
          const result = await this.translateTextChunk(chunks[i], targetLanguage);
          results.push(result);
        }
        
        return results.join(' ');
      } else {
        // For shorter text, use single request translation
        return await this.translateTextChunk(text, targetLanguage);
      }
    } catch (error) {
      console.error("All translation services failed:", error);
      onProgress?.("Translation services failed. Returning original text.");
      // Return original text with a note
      return `[Translation failed] ${text}`;
    }
  }

  private static async translateTextChunk(
    text: string,
    targetLanguage: string
  ): Promise<string> {
    try {
      // First try LibreTranslate
      try {
        console.log("Translating with LibreTranslate...");
        
        // Add a timeout for LibreTranslate
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        const response = await fetch(this.LIBRE_TRANSLATE_API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: text,
            source: "auto", // Auto-detect source language
            target: targetLanguage,
            format: "text",
          }),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          if (response.status === 429) {
            console.warn("LibreTranslate rate limit exceeded");
            throw new Error("Rate limit exceeded");
          }
          console.warn(`LibreTranslate API error: ${response.status}`);
          throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        if (!data.translatedText) {
          console.warn("LibreTranslate returned empty result");
          throw new Error("Empty result");
        }
        
        return data.translatedText;
      } catch (libreError) {
        console.warn("LibreTranslate error, trying fallback:", libreError);
        
        // Fallback to MyMemory Translation API
        console.log("Translating with MyMemory API...");
        
        // Add a timeout for MyMemory
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        // MyMemory doesn't support 'auto' as source language - try to detect language but fall back to English
        let sourceLanguage = "en"; // Default to English
        const detectedLanguage = this.detectLanguage(text);
        if (detectedLanguage) {
          sourceLanguage = detectedLanguage;
        }
        
        const myMemoryUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLanguage}|${targetLanguage}`;
        const myMemoryResponse = await fetch(myMemoryUrl, {
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!myMemoryResponse.ok) {
          throw new Error(`MyMemory API error: ${myMemoryResponse.status}`);
        }
        
        const myMemoryData = await myMemoryResponse.json();
        if (!myMemoryData.responseData?.translatedText) {
          console.warn("MyMemory returned empty result");
          throw new Error("All translation services failed to provide a result");
        }
        
        return myMemoryData.responseData.translatedText;
      }
    } catch (error) {
      console.error("Translation services error:", error);
      throw error;
    }
  }

  // Simple language detection helper
  private static detectLanguage(text: string): string | null {
    // This is a very simplistic language detection
    // In a real app, you'd use a proper language detection library
    
    const sample = text.substring(0, 100).toLowerCase();
    
    // Common character patterns that might indicate certain languages
    if (/[\u3040-\u30ff]/.test(sample)) {
      return "ja"; // Japanese characters
    }
    if (/[\u4e00-\u9fff]/.test(sample)) {
      return "zh"; // Chinese characters
    }
    if (/[а-яА-Я]/.test(sample)) {
      return "ru"; // Cyrillic characters (Russian)
    }
    if (/[àáâäæçèéêëìíîïñòóôöùúûü]/.test(sample)) {
      // Various European languages with accents
      // This is very simplistic and would need improvement
      if (/[ñ]/.test(sample)) return "es"; // Spanish
      if (/[ç]/.test(sample)) return "fr"; // French
      if (/[äöü]/.test(sample)) return "de"; // German
      // Otherwise return null and default to English
    }
    
    return null; // Default to null (will use English)
  }

  private static async saveTranslation(
    original: string,
    translated: string,
    language: string
  ) {
    try {
      // Get existing history
      const historyJson = await AsyncStorage.getItem(this.CACHE_KEY);
      const history = historyJson ? JSON.parse(historyJson) : [];

      // Add new translation
      const newEntry = {
        id: Date.now().toString(),
        original,
        translated,
        language,
        timestamp: new Date().toISOString(),
      };

      // Limit history to 20 entries
      const updatedHistory = [newEntry, ...history].slice(0, 20);

      // Save back to AsyncStorage
      await AsyncStorage.setItem(this.CACHE_KEY, JSON.stringify(updatedHistory));
    } catch (error) {
      console.error("Error saving translation history:", error);
    }
  }

  static async getTranslationHistory() {
    try {
      const historyJson = await AsyncStorage.getItem(this.CACHE_KEY);
      return historyJson ? JSON.parse(historyJson) : [];
    } catch (error) {
      console.error("Error retrieving translation history:", error);
      return [];
    }
  }

  private static async imageToBase64(uri: string): Promise<string> {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting image to base64:", error);
      throw error;
    }
  }
}

export default TranslationService;
