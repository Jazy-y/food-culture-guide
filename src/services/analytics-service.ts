import { db, auth } from "../config/firebase";
import {
  collection,
  addDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  increment,
  updateDoc,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  } from "firebase/firestore";

/**
 * Analytics Service for tracking user engagement and app usage
 */
class AnalyticsService {
  private static instance: AnalyticsService;
  private isInitialized = false;
  private sessionId: string | null = null;
  private sessionStartTime: Date | null = null;
  private currentUserId: string | null = null;
  private eventBuffer: any[] = [];
  private flushInterval: any = null;

  // Get singleton instance
  public static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  constructor() {
    // Initialize event buffer flush interval (every 30 seconds)
    this.flushInterval = setInterval(() => this.flushEvents(), 30000);
  }

  /**
   * Initialize analytics service
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Listen for auth state changes
      auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUserId = user.uid;
          this.startSession();
        } else {
          this.endSession();
          this.currentUserId = null;
        }
      });

      this.isInitialized = true;
      console.log("Analytics service initialized");
    } catch (error) {
      console.error("Error initializing analytics service:", error);
    }
  }

  /**
   * Start a new session
   */
  private startSession(): void {
    this.sessionId = new Date().getTime().toString();
    this.sessionStartTime = new Date();
    
    // Track session start
    this.trackEvent("session_start", {
      timestamp: new Date().toISOString(),
    });

    console.log("Analytics session started:", this.sessionId);
  }

  /**
   * End current session
   */
  private async endSession(): Promise<void> {
    if (!this.sessionId || !this.sessionStartTime) return;

    const sessionDuration = Math.floor(
      (new Date().getTime() - this.sessionStartTime.getTime()) / 1000
    );

    // Track session end
    await this.trackEvent("session_end", {
      session_id: this.sessionId,
      duration_seconds: sessionDuration,
      timestamp: new Date().toISOString(),
    });

    // Update user metrics
    if (this.currentUserId) {
      const userStatsRef = doc(db, "analytics_user_stats", this.currentUserId);
      
      try {
        const userStatsSnap = await getDoc(userStatsRef);
        
        if (userStatsSnap.exists()) {
          await updateDoc(userStatsRef, {
            session_count: increment(1),
            total_time_spent_seconds: increment(sessionDuration),
            last_session_timestamp: serverTimestamp(),
          });
        } else {
          await setDoc(userStatsRef, {
            user_id: this.currentUserId,
            session_count: 1,
            total_time_spent_seconds: sessionDuration,
            first_session_timestamp: serverTimestamp(),
            last_session_timestamp: serverTimestamp(),
          });
        }
      } catch (error) {
        console.error("Error updating user analytics stats:", error);
      }
    }

    this.sessionId = null;
    this.sessionStartTime = null;
    console.log("Analytics session ended");
  }

  /**
   * Track a user event
   * @param eventName Name of the event
   * @param eventData Additional data for the event
   */
  public async trackEvent(eventName: string, eventData: any = {}): Promise<void> {
    if (!this.isInitialized) {
      console.warn("Analytics service not initialized");
      return;
    }

    try {
      const eventPayload = {
        event_name: eventName,
        user_id: this.currentUserId || "anonymous",
        session_id: this.sessionId,
        timestamp: serverTimestamp(),
        ...eventData,
      };

      // Add to buffer for batch processing
      this.eventBuffer.push(eventPayload);
      
      // Flush immediately if buffer gets too large
      if (this.eventBuffer.length >= 10) {
        this.flushEvents();
      }

      // Track specific events in dedicated collections
      switch (eventName) {
        case "view_food":
          await this.trackFoodView(eventData.food_id, eventData.food_name);
          break;
        case "search":
          await this.trackSearch(eventData.query, eventData.results_count);
          break;
        case "food_recognition":
          await this.trackFoodRecognition(
            eventData.success,
            eventData.detected_food
          );
          break;
      }
    } catch (error) {
      console.error("Error tracking event:", error);
    }
  }

  /**
   * Flush events from buffer to Firestore
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const batch = this.eventBuffer.splice(0, this.eventBuffer.length);
      
      // Save events in batches
      for (const event of batch) {
        try {
          await addDoc(collection(db, "analytics_events"), event);
        } catch (docError) {
          console.warn("Error adding analytics event:", docError);
          // Continue with next event
        }
      }
      
      console.log(`Flushed ${batch.length} analytics events`);
    } catch (error) {
      console.error("Error flushing analytics events:", error);
      // Clear buffer to avoid getting stuck
      this.eventBuffer = [];
    }
  }

  /**
   * Track food item view
   */
  private async trackFoodView(foodId: string, foodName: string): Promise<void> {
    try {
      // Update global food view count
      const foodStatsRef = doc(db, "analytics_food_stats", foodId);
      const foodStatsSnap = await getDoc(foodStatsRef);
      
      if (foodStatsSnap.exists()) {
        await updateDoc(foodStatsRef, {
          view_count: increment(1),
          last_viewed: serverTimestamp(),
        });
      } else {
        await setDoc(foodStatsRef, {
          food_id: foodId,
          food_name: foodName,
          view_count: 1,
          first_viewed: serverTimestamp(),
          last_viewed: serverTimestamp(),
        });
      }
    } catch (error) {
      console.error("Error tracking food view:", error);
    }
  }

  /**
   * Track search query
   */
  private async trackSearch(query: string, resultsCount: number): Promise<void> {
    if (!query) return;
    
    try {
      // Save search query
      try {
        await addDoc(collection(db, "analytics_searches"), {
          query: query.toLowerCase().trim(),
          results_count: resultsCount,
          user_id: this.currentUserId || "anonymous",
          timestamp: serverTimestamp(),
        });
      } catch (docError) {
        console.warn("Error tracking search query:", docError);
      }
      
      // Update search terms frequency
      try {
        const searchTermRef = doc(db, "analytics_search_terms", query.toLowerCase().trim());
        const searchTermSnap = await getDoc(searchTermRef);
        
        if (searchTermSnap.exists()) {
          await updateDoc(searchTermRef, {
            count: increment(1),
            last_searched: serverTimestamp(),
          });
        } else {
          await setDoc(searchTermRef, {
            term: query.toLowerCase().trim(),
            count: 1,
            first_searched: serverTimestamp(),
            last_searched: serverTimestamp(),
          });
        }
      } catch (termError) {
        console.warn("Error updating search term frequency:", termError);
      }
    } catch (error) {
      console.error("Error tracking search:", error);
    }
  }

  /**
   * Track food recognition attempt
   */
  private async trackFoodRecognition(
    success: boolean,
    detectedFood?: string
  ): Promise<void> {
    try {
      console.log(`Tracking food recognition: success=${success}, food=${detectedFood || 'N/A'}`);
      
      try {
        await addDoc(collection(db, "analytics_recognition"), {
          success,
          detected_food: detectedFood || null,
          user_id: this.currentUserId || "anonymous",
          timestamp: serverTimestamp(),
        });
        console.log("Food recognition event saved to analytics_recognition collection");
      } catch (docError) {
        console.warn("Error tracking food recognition:", docError);
      }
      
      // Update success/failure counts
      try {
        const statsRef = doc(db, "analytics_global_stats", "food_recognition");
        const statsSnap = await getDoc(statsRef);
        
        if (statsSnap.exists()) {
          console.log("Updating existing food_recognition stats document");
          const currentStats = statsSnap.data();
          console.log("Current stats:", currentStats);
          
          await updateDoc(statsRef, {
            total_attempts: increment(1),
            successful_attempts: increment(success ? 1 : 0),
            last_updated: serverTimestamp(),
          });
          
          console.log("Food recognition stats updated successfully");
        } else {
          console.log("Creating new food_recognition stats document");
          await setDoc(statsRef, {
            total_attempts: 1,
            successful_attempts: success ? 1 : 0,
            last_updated: serverTimestamp(),
          });
          console.log("Food recognition stats created successfully");
        }
      } catch (statsError) {
        console.error("Error updating food recognition stats:", statsError);
      }
    } catch (error) {
      console.error("Error tracking food recognition:", error);
    }
  }

  /**
   * Get top viewed foods
   */
  public async getTopViewedFoods(limitCount = 10): Promise<any[]> {
    try {
      const foodStatsRef = collection(db, "analytics_food_stats");
      const q = query(foodStatsRef, orderBy("view_count", "desc"), limit(limitCount));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error getting top viewed foods:", error);
      return [];
    }
  }

  /**
   * Get top search terms
   */
  public async getTopSearchTerms(limitCount = 10): Promise<any[]> {
    try {
      const searchTermsRef = collection(db, "analytics_search_terms");
      const q = query(searchTermsRef, orderBy("count", "desc"), limit(limitCount));
      
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error("Error getting top search terms:", error);
      return [];
    }
  }

  /**
   * Get food recognition stats
   */
  public async getFoodRecognitionStats(): Promise<any> {
    try {
      const statsRef = doc(db, "analytics_global_stats", "food_recognition");
      const statsSnap = await getDoc(statsRef);
      
      if (statsSnap.exists()) {
        return statsSnap.data();
      }
      return { total_attempts: 0, successful_attempts: 0 };
    } catch (error) {
      console.error("Error getting food recognition stats:", error);
      return { total_attempts: 0, successful_attempts: 0 };
    }
  }

  /**
   * Get active users count for a given period
   * @param days Number of days to look back
   */
  public async getActiveUsers(days = 7): Promise<number> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      
      const userStatsRef = collection(db, "analytics_user_stats");
      const q = query(
        userStatsRef,
        where("last_session_timestamp", ">=", startDate)
      );
      
      const snapshot = await getDocs(q);
      return snapshot.size;
    } catch (error) {
      console.error("Error getting active users:", error);
      return 0;
    }
  }

  /**
   * Get user demographics data
   * Returns user distribution by age, gender, and location
   */
  public async getUserDemographics(): Promise<any> {
    try {
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);
      
      console.log(`Found ${snapshot.size} users total for demographics analysis`);
      
      // Initialize counters
      const demographics = {
        // Age groups
        age: {
          "18-24": 0,
          "25-34": 0,
          "35-44": 0,
          "45-54": 0,
          "55+": 0,
          "unknown": 0
        },
        // Gender distribution
        gender: {
          male: 0,
          female: 0,
          unknown: 0
        },
        // Top 5 locations
        locations: {} as Record<string, number>
      };
      
      // Process each user
      snapshot.docs.forEach((doc) => {
        const userData = doc.data();
        console.log(`Processing user ${doc.id}:`, JSON.stringify(userData.profile || {}));
        
        // Process age data - now in profile.age
        const userProfile = userData.profile || {};
        const age = userProfile.age;
        
        if (age) {
          const ageNum = parseInt(String(age));
          if (!isNaN(ageNum)) {
            if (ageNum < 25) demographics.age["18-24"]++;
            else if (ageNum < 35) demographics.age["25-34"]++;
            else if (ageNum < 45) demographics.age["35-44"]++;
            else if (ageNum < 55) demographics.age["45-54"]++;
            else demographics.age["55+"]++;
          } else {
            demographics.age.unknown++;
          }
        } else {
          demographics.age.unknown++;
        }
        
        // Process gender data - now in profile.gender
        const gender = userProfile.gender?.toLowerCase();
        if (gender) {
          if (gender === "male") demographics.gender.male++;
          else if (gender === "female") demographics.gender.female++;
        } else {
          demographics.gender.unknown++;
        }
        
        // Process location data - now in profile.location
        const location = userProfile.location;
        if (location) {
          if (!demographics.locations[location]) {
            demographics.locations[location] = 0;
          }
          demographics.locations[location]++;
        }
      });
      
      // Sort locations by count and take top 5
      const sortedLocations = Object.entries(demographics.locations)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .reduce((obj, [key, value]) => {
          obj[key] = value;
          return obj;
        }, {} as Record<string, number>);
      
      demographics.locations = sortedLocations;
      
      console.log("Processed demographics:", demographics);
      return demographics;
    } catch (error) {
      console.error("Error getting user demographics:", error);
      throw error;
    }
  }

  /**
   * Get user engagement metrics
   * Returns session duration distribution and engagement frequency
   */
  public async getUserEngagementMetrics(): Promise<any> {
    try {
      const eventsRef = collection(db, "analytics_events");
      const sessionsQuery = query(
        eventsRef, 
        where("event_name", "in", ["session_start", "session_end"])
      );
      const snapshot = await getDocs(sessionsQuery);
      
      // Group sessions by user and session ID
      const sessions: Record<string, any> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        const key = `${data.user_id}_${data.session_id}`;
        
        if (!sessions[key]) {
          sessions[key] = { user_id: data.user_id };
        }
        
        if (data.event_name === "session_start") {
          sessions[key].start_time = data.timestamp;
        } else if (data.event_name === "session_end") {
          sessions[key].end_time = data.timestamp;
          sessions[key].duration_seconds = data.duration_seconds;
        }
      });
      
      // Calculate session metrics
      const durations = Object.values(sessions)
        .filter((session: any) => session.duration_seconds)
        .map((session: any) => session.duration_seconds);
      
      // Duration buckets in minutes
      const durationBuckets = {
        "< 1 min": 0,
        "1-5 min": 0,
        "5-15 min": 0,
        "15-30 min": 0,
        "> 30 min": 0
      };
      
      durations.forEach(duration => {
        const minutes = duration / 60;
        if (minutes < 1) durationBuckets["< 1 min"]++;
        else if (minutes < 5) durationBuckets["1-5 min"]++;
        else if (minutes < 15) durationBuckets["5-15 min"]++;
        else if (minutes < 30) durationBuckets["15-30 min"]++;
        else durationBuckets["> 30 min"]++;
      });
      
      // Calculate average session duration
      const avgDuration = durations.length 
        ? durations.reduce((sum, val) => sum + val, 0) / durations.length 
        : 0;
      
      return {
        sessionDurationDistribution: durationBuckets,
        averageSessionDuration: avgDuration,
        totalSessions: durations.length
      };
    } catch (error) {
      console.error("Error getting user engagement metrics:", error);
      return null;
    }
  }
  
  /**
   * Get food recognition performance over time
   * Returns success rate by day for the last 7 days
   */
  public async getRecognitionPerformanceOverTime(days = 7): Promise<any> {
    try {
      const now = new Date();
      const startDate = new Date();
      startDate.setDate(now.getDate() - days + 1);
      startDate.setHours(0, 0, 0, 0);
      
      const eventsRef = collection(db, "analytics_recognition");
      const query = await getDocs(eventsRef);
      
      // Initialize data structure
      const dateLabels: string[] = [];
      const successData: number[] = [];
      const failureData: number[] = [];
      
      // Get dates for the last n days
      for (let i = 0; i < days; i++) {
        const date = new Date(startDate);
        date.setDate(startDate.getDate() + i);
        
        const label = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        dateLabels.push(label);
        
        // Count successful and failed recognitions for this date
        const dayStart = new Date(date);
        const dayEnd = new Date(date);
        dayEnd.setHours(23, 59, 59, 999);
        
        const dayEvents = query.docs
          .map(doc => ({ id: doc.id, ...doc.data() }))
          .filter((event: any) => {
            // Parse timestamp
            const eventTime = event.timestamp instanceof Timestamp 
              ? event.timestamp.toDate() 
              : new Date(event.timestamp);
            
            return eventTime >= dayStart && eventTime <= dayEnd;
          });
        
        const successful = dayEvents.filter((event: any) => event.success).length;
        const failed = dayEvents.length - successful;
        
        successData.push(successful);
        failureData.push(failed);
      }
      
      return {
        labels: dateLabels,
        success: successData,
        failure: failureData
      };
    } catch (error) {
      console.error("Error getting recognition performance over time:", error);
      return {
        labels: [],
        success: [],
        failure: []
      };
    }
  }

  /**
   * Get user retention data
   * Returns daily, weekly, and monthly active users over time
   */
  public async getUserRetentionData(): Promise<any> {
    try {
      const now = new Date();
      const users: Record<string, any> = {};
      
      // Get user sessions from analytics events
      const eventsRef = collection(db, "analytics_events");
      const sessionsQuery = query(
        eventsRef,
        where("event_name", "==", "session_start"),
        orderBy("timestamp", "desc"),
        limit(1000) // Limit to last 1000 sessions for performance
      );
      
      const sessionsSnapshot = await getDocs(sessionsQuery);
      
      sessionsSnapshot.docs.forEach(doc => {
        const data = doc.data();
        const userId = data.user_id;
        const timestamp = data.timestamp instanceof Timestamp 
          ? data.timestamp.toDate() 
          : new Date(data.timestamp);
        
        if (!users[userId]) {
          users[userId] = {
            lastActive: timestamp,
            sessionsCount: 0
          };
        }
        
        users[userId].sessionsCount++;
        
        if (timestamp > users[userId].lastActive) {
          users[userId].lastActive = timestamp;
        }
      });
      
      // Calculate retention metrics
      const oneDay = 24 * 60 * 60 * 1000;
      const sevenDays = 7 * oneDay;
      const thirtyDays = 30 * oneDay;
      
      const userValues = Object.values(users);
      const dau = userValues.filter((u: any) => 
        now.getTime() - u.lastActive.getTime() < oneDay
      ).length;
      
      const wau = userValues.filter((u: any) => 
        now.getTime() - u.lastActive.getTime() < sevenDays
      ).length;
      
      const mau = userValues.filter((u: any) => 
        now.getTime() - u.lastActive.getTime() < thirtyDays
      ).length;
      
      // Calculate retention rate (users who returned after their first session)
      const returningUsers = userValues.filter((u: any) => u.sessionsCount > 1).length;
      const retentionRate = userValues.length > 0 
        ? (returningUsers / userValues.length) * 100 
        : 0;
      
      return {
        dailyActiveUsers: dau,
        weeklyActiveUsers: wau,
        monthlyActiveUsers: mau,
        totalUsers: userValues.length,
        retentionRate: retentionRate
      };
    } catch (error) {
      console.error("Error getting user retention data:", error);
      return null;
    }
  }

  /**
   * Clean up resources
   */
  public dispose(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    
    if (this.sessionId) {
      this.endSession();
    }
    
    this.flushEvents();
    console.log("Analytics service disposed");
  }
}

// Export singleton instance
export const analyticsService = AnalyticsService.getInstance();
export default analyticsService; 