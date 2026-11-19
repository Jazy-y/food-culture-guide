import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types/navigation";
import { analyticsService } from "../services/analytics-service";
import { db } from "../config/firebase";
import {
  collection,
  getDocs,
  Timestamp,
} from "firebase/firestore";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "AnalyticsDashboard">;

interface UserGrowthData {
  labels: string[];
  datasets: {
    data: number[];
    color?: (opacity?: number) => string;
    strokeWidth?: number;
  }[];
}

interface SessionData {
  labels: string[];
  data: number[];
}

const AnalyticsDashboardScreen: React.FC<Props> = ({ navigation }) => {
  const { userData } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "overview" | "foods" | "users" | "recognition"
  >("overview");

  // Analytics data states
  const [topFoods, setTopFoods] = useState<any[]>([]);
  const [topSearches, setTopSearches] = useState<any[]>([]);
  const [recognitionStats, setRecognitionStats] = useState<any>({
    total_attempts: 0,
    successful_attempts: 0,
  });
  const [activeUsers, setActiveUsers] = useState<number>(0);
  const [userGrowthData, setUserGrowthData] = useState<UserGrowthData>({
    labels: [],
    datasets: [{ data: [] }],
  });
  const [dailyActiveData, setDailyActiveData] = useState<UserGrowthData>({
    labels: [],
    datasets: [{ data: [] }],
  });
  const [sessionData, setSessionData] = useState<SessionData>({
    labels: [],
    data: [],
  });
  // New analytics data states
  const [userDemographics, setUserDemographics] = useState<any>(null);
  const [userEngagement, setUserEngagement] = useState<any>(null);
  const [recognitionPerformance, setRecognitionPerformance] = useState<any>(null);
  const [userRetention, setUserRetention] = useState<any>(null);

  useEffect(() => {
    if (!userData?.isAdmin) {
      navigation.replace("Home");
      return;
    }

    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    setLoading(true);
    try {
      console.log("Loading analytics data...");
      
      // First load the demographics data separately to troubleshoot
      const demographicsData = await analyticsService.getUserDemographics();
      console.log("Demographics data loaded:", demographicsData);
      setUserDemographics(demographicsData);
      
      // Load the rest of the analytics data in parallel
      const [
        topFoodsData,
        topSearchesData,
        recognitionStatsData,
        activeUsersCount,
        usersGrowth,
        dailyUsage,
        sessionStats,
        userEngagementData,
        recognitionPerformanceData,
        userRetentionData
      ] = await Promise.all([
        analyticsService.getTopViewedFoods(10),
        analyticsService.getTopSearchTerms(10),
        analyticsService.getFoodRecognitionStats(),
        analyticsService.getActiveUsers(7),
        loadUserGrowthData(),
        loadDailyActiveData(),
        loadSessionData(),
        analyticsService.getUserEngagementMetrics(),
        analyticsService.getRecognitionPerformanceOverTime(7),
        analyticsService.getUserRetentionData()
      ]);

      setTopFoods(topFoodsData);
      setTopSearches(topSearchesData);
      setRecognitionStats(recognitionStatsData);
      setActiveUsers(activeUsersCount);
      setUserGrowthData(usersGrowth);
      setDailyActiveData(dailyUsage);
      setSessionData(sessionStats);
      setUserEngagement(userEngagementData);
      setRecognitionPerformance(recognitionPerformanceData);
      setUserRetention(userRetentionData);
      
      console.log("All analytics data loaded successfully");
    } catch (error) {
      console.error("Error loading analytics data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUserGrowthData = async (): Promise<UserGrowthData> => {
    try {
      // Get user growth data for the last 7 days
      const usersRef = collection(db, "users");
      const snapshot = await getDocs(usersRef);

      // Group users by creation date
      const users = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      // Get dates for the last 7 days
      const dateLabels: string[] = [];
      const dateCounts: number[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const label = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        
        dateLabels.push(label);
        
        // Count users created on this date
        const count = users.filter((user: any) => {
          if (!user.createdAt) return false;
          
          const createdAt = user.createdAt instanceof Timestamp 
            ? user.createdAt.toDate() 
            : new Date(user.createdAt);
          
          const createdDate = new Date(createdAt);
          createdDate.setHours(0, 0, 0, 0);
          
          return createdDate.getTime() === date.getTime();
        }).length;
        
        dateCounts.push(count);
      }

      return {
        labels: dateLabels,
        datasets: [
          {
            data: dateCounts,
            color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      };
    } catch (error) {
      console.error("Error loading user growth data:", error);
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }
  };

  const loadDailyActiveData = async (): Promise<UserGrowthData> => {
    try {
      // Get daily active users for the last 7 days
      // This would normally come from analytics_events collection
      // For now, we'll generate sample data
      const labels: string[] = [];
      const data: number[] = [];
      const now = new Date();

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(now.getDate() - i);
        
        const label = date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        });
        
        labels.push(label);
        
        // Generate random data between 10-50 for demo
        const randomValue = Math.floor(Math.random() * 40) + 10;
        data.push(randomValue);
      }

      return {
        labels,
        datasets: [
          {
            data,
            color: (opacity = 1) => `rgba(51, 102, 255, ${opacity})`,
            strokeWidth: 2,
          },
        ],
      };
    } catch (error) {
      console.error("Error loading daily active data:", error);
      return {
        labels: [],
        datasets: [{ data: [] }],
      };
    }
  };

  const loadSessionData = async (): Promise<SessionData> => {
    // Generate sample session duration data
    // This would come from real analytics in production
    return {
      labels: ["<1m", "1-5m", "5-15m", "15-30m", ">30m"],
      data: [15, 25, 35, 20, 5],
    };
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadAnalyticsData();
  };

  const calculateBarHeight = (value: number): number => {
    // Base height for zero value
    if (value === 0) return 5;
    
    // Scale the height based on the value
    // Using log scale to make small values still visible
    return Math.max(20, Math.min(100, 20 + Math.log10(value + 1) * 40));
  };

  const renderOverviewTab = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#FF6B35" />;
    }

    // Calculate some useful metrics
    const successRate = recognitionStats.total_attempts
      ? Math.round(
          (recognitionStats.successful_attempts / recognitionStats.total_attempts) * 100
        )
      : 0;

    const mostActiveDay = dailyActiveData.labels && dailyActiveData.datasets && dailyActiveData.datasets[0].data
      ? dailyActiveData.labels[
          dailyActiveData.datasets[0].data.indexOf(
            Math.max(...dailyActiveData.datasets[0].data)
          )
        ]
      : "N/A";

    const topFood = topFoods && topFoods.length > 0 ? topFoods[0].food_name : "N/A";
    const topSearch = topSearches && topSearches.length > 0 ? topSearches[0].term : "N/A";

    return (
      <View style={styles.tabContent}>
        {/* Key Stats Cards */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeUsers}</Text>
            <Text style={styles.statLabel}>Active Users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{topFoods.length}</Text>
            <Text style={styles.statLabel}>Tracked Foods</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{successRate}%</Text>
            <Text style={styles.statLabel}>Recognition Rate</Text>
          </View>
        </View>

        {/* Analytics Summary Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Analytics Summary</Text>
          <Text style={styles.summaryText}>
            Your app currently has <Text style={styles.highlightText}>{activeUsers} active users</Text> in the last 7 days. 
            The most popular food is <Text style={styles.highlightText}>{topFood}</Text> and users are searching most 
            frequently for <Text style={styles.highlightText}>{topSearch}</Text>. 
            The food recognition feature is working with <Text style={styles.highlightText}>{successRate}%</Text> accuracy.
          </Text>
          
          <View style={styles.summaryStats}>
            <View style={styles.summaryStatItem}>
              <Ionicons name="calendar-outline" size={20} color="#FF6B35" />
              <Text style={styles.summaryStatText}>Most active: {mostActiveDay}</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Ionicons name="star-outline" size={20} color="#FF6B35" />
              <Text style={styles.summaryStatText}>Top food: {topFood}</Text>
            </View>
            <View style={styles.summaryStatItem}>
              <Ionicons name="search-outline" size={20} color="#FF6B35" />
              <Text style={styles.summaryStatText}>Top search: {topSearch}</Text>
            </View>
          </View>
        </View>

        {/* Top Foods Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Most Viewed Foods</Text>
          {topFoods.length > 0 ? (
            <BarChart
              data={{
                labels: topFoods.slice(0, 5).map(food => truncateText(food.food_name, 10)),
                datasets: [
                  {
                    data: topFoods.slice(0, 5).map(food => food.view_count),
                  },
                ],
              }}
              width={width - 40}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                barPercentage: 0.7,
              }}
              style={styles.chart}
            />
          ) : (
            <Text style={styles.noDataText}>No food view data available</Text>
          )}
        </View>

        {/* User Activity Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Daily Active Users (7 Days)</Text>
          {dailyActiveData.labels?.length > 0 ? (
            <LineChart
              data={dailyActiveData}
              width={width - 40}
              height={220}
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(51, 102, 255, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                propsForDots: {
                  r: "6",
                  strokeWidth: "2",
                  stroke: "#3366FF",
                },
              }}
              bezier
              style={styles.chart}
            />
          ) : (
            <Text style={styles.noDataText}>No user activity data available</Text>
          )}
        </View>

        {/* Quick Insights */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Quick Insights</Text>
          <View style={styles.insightItem}>
            <Ionicons name="trending-up" size={24} color="#4CAF50" style={styles.insightIcon} />
            <Text style={styles.insightText}>
              {topFoods.length > 0
                ? `"${topFoods[0].food_name}" is trending with ${topFoods[0].view_count} views`
                : "No trending foods yet"}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="search" size={24} color="#FF6B35" style={styles.insightIcon} />
            <Text style={styles.insightText}>
              {topSearches.length > 0
                ? `"${topSearches[0].term}" is the most searched term`
                : "No search trends yet"}
            </Text>
          </View>
          <View style={styles.insightItem}>
            <Ionicons name="camera" size={24} color="#3366FF" style={styles.insightIcon} />
            <Text style={styles.insightText}>
              {recognitionStats.total_attempts
                ? `Food recognition success rate is ${successRate}%`
                : "No food recognition data yet"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderFoodsTab = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#FF6B35" />;
    }

    return (
      <View style={styles.tabContent}>
        {/* Food Views Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{topFoods.length}</Text>
            <Text style={styles.statLabel}>Foods Tracked</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topFoods.reduce((sum, food) => sum + food.view_count, 0)}
            </Text>
            <Text style={styles.statLabel}>Total Views</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {topFoods.length > 0 
                ? Math.round(topFoods.reduce((sum, food) => sum + food.view_count, 0) / topFoods.length) 
                : 0}
            </Text>
            <Text style={styles.statLabel}>Avg. Views</Text>
          </View>
        </View>

        {/* Most Popular Foods Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Most Popular Foods</Text>
          {topFoods.length > 0 ? (
            <BarChart
              data={{
                labels: topFoods.slice(0, 5).map(food => truncateText(food.food_name, 10)),
                datasets: [
                  {
                    data: topFoods.slice(0, 5).map(food => food.view_count),
                  },
                ],
              }}
              width={width - 40}
              height={220}
              yAxisLabel=""
              yAxisSuffix=""
              chartConfig={{
                backgroundColor: "#ffffff",
                backgroundGradientFrom: "#ffffff",
                backgroundGradientTo: "#ffffff",
                decimalPlaces: 0,
                color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                style: {
                  borderRadius: 16,
                },
                barPercentage: 0.7,
              }}
              style={styles.chart}
            />
          ) : (
            <Text style={styles.noDataText}>No food view data available</Text>
          )}
        </View>

        {/* Popular Search Terms */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Most Popular Search Terms</Text>
          {topSearches.length > 0 ? (
            topSearches.slice(0, 5).map((item, index) => (
              <View key={`search-${index}`} style={styles.searchTermItem}>
                <View style={[styles.rankBadge, { backgroundColor: getRandomColor(index) }]}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <View style={styles.searchTermInfo}>
                  <Text style={styles.searchTermText}>&quot;{item.term}&quot;</Text>
                  <Text style={styles.searchCountText}>{item.count} searches</Text>
                </View>
                <View style={styles.searchTermMetric}>
                  <Ionicons name="search" size={16} color="#FF6B35" />
                  <Text style={styles.metricText}>{item.count}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No search term data available</Text>
          )}
        </View>

        {/* Top Foods List with Details */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Food Insights</Text>
          {topFoods.length > 0 ? (
            topFoods.slice(0, 10).map((item, index) => (
              <View key={`food-${index}`} style={styles.foodInsightItem}>
                <View style={styles.foodInsightRank}>
                  <Text style={styles.foodRankText}>{index + 1}</Text>
                </View>
                <View style={styles.foodInsightDetails}>
                  <Text style={styles.foodNameText}>{item.food_name}</Text>
                  <View style={styles.foodMetrics}>
                    <View style={styles.foodMetric}>
                      <Ionicons name="eye-outline" size={16} color="#666" />
                      <Text style={styles.foodMetricText}>{item.view_count} views</Text>
                    </View>
                    <View style={styles.foodMetric}>
                      <Ionicons name="time-outline" size={16} color="#666" />
                      <Text style={styles.foodMetricText}>
                        {formatDate(item.last_viewed) || "N/A"}
                      </Text>
                    </View>
                  </View>
                </View>
                <View style={styles.foodTrending}>
                  {item.view_count > (topFoods[Math.min(index + 1, topFoods.length - 1)]?.view_count || 0) * 1.5 && (
                    <Ionicons name="trending-up" size={20} color="#4CAF50" />
                  )}
                </View>
              </View>
            ))
          ) : (
            <Text style={styles.noDataText}>No food data available</Text>
          )}
        </View>

        {/* Food Recognition Performance */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Recognition Performance</Text>
          <View style={styles.recognitionPerformanceRow}>
            <View style={styles.performanceMetric}>
              <Text style={styles.performanceValue}>
                {recognitionStats.successful_attempts || 0}
              </Text>
              <Text style={styles.performanceLabel}>Successful</Text>
            </View>
            <View style={styles.performanceMetric}>
              <Text style={styles.performanceValue}>
                {(recognitionStats.total_attempts || 0) - (recognitionStats.successful_attempts || 0)}
              </Text>
              <Text style={styles.performanceLabel}>Failed</Text>
            </View>
            <View style={styles.performanceMetric}>
              <Text style={styles.performanceValue}>
                {recognitionStats.total_attempts
                  ? `${Math.round(
                      (recognitionStats.successful_attempts / recognitionStats.total_attempts) * 100
                    )}%`
                  : "0%"}
              </Text>
              <Text style={styles.performanceLabel}>Success Rate</Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderUsersTab = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#FF6B35" />;
    }

    // Basic check if demographics data is available
    if (!userDemographics) {
      return (
        <View style={styles.tabContent}>
          <Text style={styles.noDataText}>No user demographic data available</Text>
          <TouchableOpacity style={styles.refreshButton} onPress={onRefresh}>
            <Text style={styles.refreshButtonText}>Refresh Data</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.tabContent}>
        {/* User Demographics Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{activeUsers}</Text>
            <Text style={styles.statLabel}>Active Users</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {userDemographics.gender.male + userDemographics.gender.female + userDemographics.gender.other}
            </Text>
            <Text style={styles.statLabel}>With Demographics</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>
              {Object.keys(userDemographics.locations).length || 0}
            </Text>
            <Text style={styles.statLabel}>Locations</Text>
          </View>
        </View>

        {/* Demographic Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>User Demographics</Text>
          
          {userDemographics ? (
            <>
              {/* Age Distribution */}
              <Text style={styles.demographicSubtitle}>Age Distribution</Text>
              <View style={styles.demographicsContainer}>
                {Object.entries(userDemographics.age || {}).map(([ageGroup, count]: [string, any]) => (
                  <View key={ageGroup} style={styles.demographicItem}>
                    <Text style={styles.demographicLabel}>{ageGroup}</Text>
                    <View style={styles.demographicBarContainer}>
                      <View 
                        style={[
                          styles.demographicBar, 
                          { 
                            width: `${Math.max(5, (count / (Object.values(userDemographics.age || {}) as number[]).reduce((a, b) => a + b, 0)) * 100)}%`,
                            backgroundColor: getRandomColor(ageGroup.charCodeAt(0))
                          }
                        ]} 
                      />
                    </View>
                    <Text style={styles.demographicValue}>{count}</Text>
                  </View>
                ))}
              </View>
              
              {/* Gender Distribution */}
              <Text style={styles.demographicSubtitle}>Gender Distribution</Text>
              
              <PieChart
                data={Object.entries(userDemographics.gender || {}).map(([gender, count]: [string, any], index) => ({
                  name: gender.charAt(0).toUpperCase() + gender.slice(1),
                  population: count,
                  color: getRandomColor(index),
                  legendFontColor: "#7F7F7F",
                  legendFontSize: 12,
                }))}
                width={width - 80}
                height={180}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
                }}
                accessor={"population"}
                backgroundColor={"transparent"}
                paddingLeft={"15"}
                absolute
              />
            </>
          ) : (
            <Text style={styles.noDataText}>No demographic data available</Text>
          )}
        </View>
              
        {/* Top Locations */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Top Locations</Text>
          <View style={styles.demographicsContainer}>
            {userDemographics && Object.entries(userDemographics.locations || {}).length > 0 ? (
              Object.entries(userDemographics.locations).map(([location, count]: [string, any], index) => (
                <View key={location} style={styles.locationItem}>
                  <Text style={styles.locationRank}>{index + 1}</Text>
                  <Text style={styles.locationName}>{location}</Text>
                  <Text style={styles.locationCount}>{count} users</Text>
                </View>
              ))
            ) : (
              <Text style={styles.noDataText}>No location data available</Text>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderRecognitionTab = () => {
    if (loading) {
      return <ActivityIndicator size="large" color="#FF6B35" />;
    }

    // Calculate success rate percentage
    const total = recognitionStats.total_attempts || 0;
    const successful = recognitionStats.successful_attempts || 0;
    const successRate = total > 0 ? (successful / total) * 100 : 0;

    return (
      <View style={styles.tabContent}>
        {/* Recognition Stats Summary */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{total}</Text>
            <Text style={styles.statLabel}>Total Attempts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{successful}</Text>
            <Text style={styles.statLabel}>Successful</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{`${successRate.toFixed(1)}%`}</Text>
            <Text style={styles.statLabel}>Success Rate</Text>
          </View>
        </View>

        {/* Recognition Performance Over Time */}
        {recognitionPerformance && recognitionPerformance.labels.length > 0 && (
          <View style={styles.chartContainer}>
            <Text style={styles.chartTitle}>Recognition Performance (7 Days)</Text>
            
            {/* Chart Legend */}
            <View style={styles.chartLegendRow}>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#4CAF50" }]} />
                <Text style={styles.legendText}>Success</Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#F44336" }]} />
                <Text style={styles.legendText}>Failure</Text>
              </View>
            </View>
            
            <View style={styles.chartDivider} />
            
            {/* Y-axis label at the top of chart */}
            <Text style={styles.yAxisLabelTop}>Number of recognitions</Text>
            
            {/* Grouped bar chart displaying both data series side by side */}
            <View style={styles.customBarChartContainer}>
              {recognitionPerformance.labels.map((label, index) => (
                <View key={`bar-group-${index}`} style={styles.barChartGroup}>
                  <View style={styles.barChartLabelContainer}>
                    <Text style={styles.barChartLabel}>{label}</Text>
                  </View>
                  <View style={styles.barPair}>
                    <View style={styles.barColumn}>
                      <View 
                        style={[
                          styles.barValue, 
                          { 
                            height: calculateBarHeight(recognitionPerformance.success[index]),
                            backgroundColor: "#4CAF50" 
                          }
                        ]}
                      />
                      <Text style={styles.barValueLabel}>
                        {recognitionPerformance.success[index]}
                      </Text>
                    </View>
                    <View style={styles.barColumn}>
                      <View 
                        style={[
                          styles.barValue, 
                          { 
                            height: calculateBarHeight(recognitionPerformance.failure[index]),
                            backgroundColor: recognitionPerformance.failure[index] > 0 ? "#F44336" : "#f0f0f0" 
                          }
                        ]}
                      />
                      <Text style={styles.barValueLabel}>
                        {recognitionPerformance.failure[index]}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Success Rate Pie Chart */}
        <View style={styles.chartContainer}>
          <Text style={styles.chartTitle}>Recognition Success Rate</Text>
          
          {/* Only render if we have valid data */}
          {recognitionStats && recognitionStats.total_attempts > 0 ? (
            <View style={styles.simplePieContainer}>
              <PieChart
                data={[
                  {
                    name: "Success",
                    population: recognitionStats.successful_attempts,
                    color: "#4CAF50",
                    legendFontColor: "#666666",
                    legendFontSize: 14,
                  },
                  {
                    name: "Failure",
                    population: recognitionStats.total_attempts === recognitionStats.successful_attempts ? 0 : 
                                Math.max(1, recognitionStats.total_attempts - recognitionStats.successful_attempts),
                    color: "#F44336",
                    legendFontColor: "#666666",
                    legendFontSize: 14,
                  },
                ]}
                width={width - 40}
                height={200}
                chartConfig={{
                  backgroundColor: "#ffffff",
                  backgroundGradientFrom: "#ffffff",
                  backgroundGradientTo: "#ffffff",
                  color: (opacity = 1) => `rgba(255, 107, 53, ${opacity})`,
                  labelColor: (opacity = 1) => `rgba(51, 51, 51, ${opacity})`,
                  style: {
                    borderRadius: 16,
                  },
                  propsForLabels: {
                    fontSize: 14,
                    fontWeight: "bold",
                  },
                  useShadowColorFromDataset: false,
                  decimalPlaces: 0,
                }}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="0"
                absolute
                hasLegend={true}
                avoidFalseZero
              />
            </View>
          ) : (
            <View style={styles.placeholderChart}>
              <Text style={styles.placeholderText}>No recognition data available</Text>
            </View>
          )}
          
          {/* Show a summary text for clearer understanding */}
          {recognitionStats && recognitionStats.total_attempts > 0 && (
            <View style={styles.pieChartSummary}>
              <Text style={styles.pieChartSummaryText}>
                {recognitionStats.successful_attempts} successful of {recognitionStats.total_attempts} total recognitions
                {recognitionStats.successful_attempts === recognitionStats.total_attempts && 
                  " (100% success rate)"}
              </Text>
            </View>
          )}
        </View>

        {/* Model Performance Suggestions */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Model Performance Insights</Text>
          <Text style={styles.infoText}>
            {successRate >= 80
              ? "Your food recognition model is performing well with a high success rate. Continue monitoring for any changes."
              : successRate >= 60
              ? "Your model has a decent recognition rate but could be improved. Consider training with more diverse food images."
              : "Your model's success rate is low. We recommend retraining the model with a larger dataset of food images focusing on commonly misidentified items."}
          </Text>
        </View>

        {/* Daily Success Rate Trend */}
        {recognitionPerformance && recognitionPerformance.labels.length > 0 && (
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Success Rate Trend</Text>
            <Text style={styles.infoText}>
              {calculateSuccessTrend(recognitionPerformance)}
            </Text>
          </View>
        )}

        {/* Recommendations */}
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Recommendations</Text>
          <View style={styles.recommendationItem}>
            <Ionicons name="analytics-outline" size={24} color="#FF6B35" style={styles.recommendationIcon} />
            <Text style={styles.recommendationText}>
              Analyze most frequently misidentified foods and add more training samples for those categories
            </Text>
          </View>
          <View style={styles.recommendationItem}>
            <Ionicons name="images-outline" size={24} color="#FF6B35" style={styles.recommendationIcon} />
            <Text style={styles.recommendationText}>
              Increase training data diversity with different lighting conditions and angles
            </Text>
          </View>
          <View style={styles.recommendationItem}>
            <Ionicons name="cog-outline" size={24} color="#FF6B35" style={styles.recommendationIcon} />
            <Text style={styles.recommendationText}>
              Fine-tune model parameters for better recognition of local foods
            </Text>
          </View>
        </View>
      </View>
    );
  };

  // Helper functions
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "";
    return text.length > maxLength ? text.substring(0, maxLength - 3) + "..." : text;
  };

  const formatDate = (timestamp: any) => {
    if (!timestamp) return "N/A";
    
    const date = timestamp instanceof Timestamp 
      ? timestamp.toDate() 
      : new Date(timestamp);
    
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  const getRandomColor = (index: number) => {
    const colors = [
      "#FF6B35", // Orange
      "#4CAF50", // Green
      "#3366FF", // Blue
      "#9C27B0", // Purple
      "#FFD700", // Gold
    ];
    return colors[index % colors.length];
  };

  // Helper to calculate trend in success rate
  const calculateSuccessTrend = (performanceData: any) => {
    if (!performanceData || !performanceData.success || performanceData.success.length < 2) {
      return "Insufficient data to determine success rate trend.";
    }

    const successRates: number[] = [];
    for (let i = 0; i < performanceData.success.length; i++) {
      const total = performanceData.success[i] + performanceData.failure[i];
      const rate = total > 0 ? (performanceData.success[i] / total) * 100 : 0;
      successRates.push(rate);
    }

    // Calculate trend
    const firstHalf = successRates.slice(0, Math.floor(successRates.length / 2));
    const secondHalf = successRates.slice(Math.floor(successRates.length / 2));
    
    const firstHalfAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const trendPercent = Math.abs(((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100);
    
    if (secondHalfAvg > firstHalfAvg + 5) {
      return `Improving trend: Success rate has increased by ${trendPercent.toFixed(1)}% in the last few days. Your model is becoming more accurate.`;
    } else if (secondHalfAvg < firstHalfAvg - 5) {
      return `Declining trend: Success rate has decreased by ${trendPercent.toFixed(1)}% in the last few days. Consider reviewing recent changes to the model.`;
    } else {
      return "Stable trend: Success rate has remained consistent over the last week.";
    }
  };

  // Render the dashboard
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "overview" && styles.activeTabButton]}
          onPress={() => setActiveTab("overview")}
        >
          <Text style={[styles.tabText, activeTab === "overview" && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "foods" && styles.activeTabButton]}
          onPress={() => setActiveTab("foods")}
        >
          <Text style={[styles.tabText, activeTab === "foods" && styles.activeTabText]}>
            Foods
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "users" && styles.activeTabButton]}
          onPress={() => setActiveTab("users")}
        >
          <Text style={[styles.tabText, activeTab === "users" && styles.activeTabText]}>
            Users
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "recognition" && styles.activeTabButton]}
          onPress={() => setActiveTab("recognition")}
        >
          <Text style={[styles.tabText, activeTab === "recognition" && styles.activeTabText]}>
            Recognition
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.contentContainer}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {activeTab === "overview" && renderOverviewTab()}
        {activeTab === "foods" && renderFoodsTab()}
        {activeTab === "users" && renderUsersTab()}
        {activeTab === "recognition" && renderRecognitionTab()}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginLeft: 10,
    color: "#333333",
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: "#FF6B35",
  },
  tabText: {
    fontSize: 14,
    color: "#666666",
  },
  activeTabText: {
    color: "#FF6B35",
    fontWeight: "bold",
  },
  contentContainer: {
    flex: 1,
  },
  content: {
    padding: 20,
  },
  tabContent: {
    flex: 1,
  },
  statsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginHorizontal: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    alignItems: "center",
  },
  statValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FF6B35",
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
  },
  chartContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
  },
  chart: {
    marginVertical: 8,
    borderRadius: 10,
  },
  noDataText: {
    color: "#999999",
    textAlign: "center",
    marginVertical: 20,
    fontStyle: "italic",
  },
  listContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  listTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  listRank: {
    width: 30,
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  listName: {
    flex: 1,
    fontSize: 14,
    color: "#333333",
  },
  listValueContainer: {
    alignItems: "flex-end",
  },
  listValue: {
    fontSize: 14,
    fontWeight: "500",
    color: "#333333",
  },
  listDate: {
    fontSize: 12,
    color: "#999999",
    marginTop: 2,
  },
  placeholderChart: {
    height: 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
  },
  placeholderText: {
    textAlign: "center",
    color: "#999999",
    paddingHorizontal: 20,
    fontStyle: "italic",
  },
  infoCard: {
    backgroundColor: "#ffffff",
    borderRadius: 10,
    padding: 15,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
  },
  infoText: {
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
  recommendationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  recommendationIcon: {
    marginRight: 10,
  },
  recommendationText: {
    flex: 1,
    fontSize: 14,
    color: "#666666",
  },
  retentionContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  retentionBar: {
    flex: 1,
    height: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  retentionFill: {
    height: "100%",
    backgroundColor: "#FF6B35",
  },
  retentionText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333333",
    marginLeft: 10,
  },
  retentionInsight: {
    fontSize: 12,
    color: "#666666",
    marginTop: 5,
  },
  demographicSubtitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#333333",
  },
  demographicsContainer: {
    marginBottom: 20,
  },
  demographicItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  demographicLabel: {
    flex: 1,
    fontSize: 14,
    color: "#333333",
  },
  demographicBarContainer: {
    flex: 1,
    height: 20,
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  demographicBar: {
    height: "100%",
    backgroundColor: "#FF6B35",
  },
  demographicValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333333",
    marginLeft: 10,
  },
  pieChartContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  locationItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  locationRank: {
    width: 30,
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  locationName: {
    flex: 1,
    fontSize: 14,
    color: "#333333",
  },
  locationCount: {
    fontSize: 12,
    color: "#999999",
  },
  sessionMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  sessionMetricItem: {
    flex: 1,
    alignItems: "center",
  },
  sessionMetricValue: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 5,
  },
  sessionMetricLabel: {
    fontSize: 12,
    color: "#666666",
  },
  sessionDistribution: {
    height: 100,
    marginBottom: 20,
  },
  sessionDistItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
  },
  sessionDistBarContainer: {
    flex: 1,
    height: "100%",
    backgroundColor: "#f0f0f0",
    borderRadius: 10,
    overflow: "hidden",
  },
  sessionDistBar: {
    height: "100%",
    backgroundColor: "#FF6B35",
  },
  sessionDistLabel: {
    fontSize: 12,
    color: "#333333",
    marginLeft: 10,
  },
  chartSeparator: {
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  chartLegendRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 15,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 15,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 10,
  },
  legendText: {
    fontSize: 14,
    color: "#666666",
  },
  summaryText: {
    fontSize: 14,
    color: "#666666",
    lineHeight: 20,
  },
  highlightText: {
    fontWeight: "bold",
  },
  summaryStats: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  summaryStatItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryStatText: {
    fontSize: 14,
    color: "#333333",
    marginLeft: 5,
  },
  insightItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  insightIcon: {
    marginRight: 10,
  },
  insightText: {
    flex: 1,
    fontSize: 14,
    color: "#666666",
  },
  searchTermItem: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  rankBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FF6B35",
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#ffffff",
  },
  searchTermInfo: {
    flex: 1,
    marginHorizontal: 10,
  },
  searchTermText: {
    fontSize: 14,
    color: "#333333",
  },
  searchCountText: {
    fontSize: 12,
    color: "#999999",
  },
  searchTermMetric: {
    flexDirection: "row",
    alignItems: "center",
  },
  metricText: {
    fontSize: 12,
    color: "#333333",
    marginLeft: 5,
  },
  foodInsightItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#eeeeee",
  },
  foodInsightRank: {
    width: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  foodRankText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FF6B35",
  },
  foodInsightDetails: {
    flex: 1,
  },
  foodNameText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 4,
  },
  foodMetrics: {
    flexDirection: "row",
    alignItems: "center",
  },
  foodMetric: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  foodMetricText: {
    fontSize: 12,
    color: "#666666",
    marginLeft: 4,
  },
  foodTrending: {
    width: 24,
    alignItems: "center",
  },
  recognitionPerformanceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 10,
  },
  performanceMetric: {
    flex: 1,
    alignItems: "center",
  },
  performanceValue: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333333",
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: "#666666",
  },
  refreshButton: {
    backgroundColor: "#FF6B35",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 20,
  },
  refreshButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#ffffff",
  },
  customBarChartContainer: {
    padding: 10, 
    marginTop: 5,
    marginBottom: 15,
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
  },
  barChartGroup: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    justifyContent: "space-between",
  },
  barChartLabelContainer: {
    width: 60,
    marginRight: 10,
    alignItems: "center",
  },
  barChartLabel: {
    fontSize: 12,
    color: "#666666",
    textAlign: "center",
  },
  barPair: {
    flexDirection: "row",
    alignItems: "flex-end",
    flex: 1,
    height: 100,
    justifyContent: "center",
  },
  barColumn: {
    alignItems: "center",
    width: 40,
    marginHorizontal: 10,
  },
  barValue: {
    width: 25,
    minHeight: 2,
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
  },
  barValueLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#333333",
    marginTop: 5,
  },
  yAxisLabelTop: {
    fontSize: 12,
    color: "#666666",
    marginTop: 5,
    marginBottom: 5,
    textAlign: "center",
    fontStyle: "italic",
  },
  pieChartSummary: {
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
    borderRadius: 10,
  },
  pieChartSummaryText: {
    textAlign: "center",
    color: "#666666",
    paddingHorizontal: 20,
    fontStyle: "italic",
  },
  chartDivider: {
    height: 1,
    backgroundColor: "#eeeeee",
    marginVertical: 10,
  },
  simplePieContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
});

export default AnalyticsDashboardScreen; 