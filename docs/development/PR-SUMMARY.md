> Historical implementation notes. For current installation and configuration, see [README](../../README.md). Some described behavior is experimental.

# Food Culture Guide Enhancement PR Summary

This PR introduces several significant enhancements to the Food Culture Guide application, focusing on analytics, user experience improvements, and internationalization capabilities.

## 1. Currency Selection Feature
- Added user-configurable currency preference in the profile screen
- Implemented currency conversion utility that converts prices from TND (Tunisian Dinar) to other currencies
- Added support for multiple currencies: USD, EUR, GBP, JPY, and TND
- Updated all price displays across the app to respect user's currency preference

## 2. Advanced Analytics Dashboard
- Created a comprehensive analytics service to track user engagement
- Implemented an analytics dashboard with multiple views:
  - Overview: Active users, most popular foods, and session statistics
  - Foods: Charts of most viewed foods and popular search terms
  - Users: User growth and activity tracking
  - Recognition: Food recognition success rate and model performance metrics
- Added real-time data visualization with charts and metrics
- Integrated analytics tracking across key user interactions:
  - Food viewing
  - Search queries
  - Food recognition attempts
  - User session data

## 3. Improved User Profile Management
- Enhanced user profile editing capabilities
- Added support for changing user avatar with camera or gallery options
- Implemented secure password change through email reset
- Updated display name editing with proper validation

## 4. Connected to Production Firebase
- Switched from Firebase Emulator to the production Firebase database
- Ensured all data is persistently stored for graduation project evaluation

## Technical Implementation Highlights
- Used singleton pattern for analytics service to ensure consistent tracking
- Implemented efficient event buffering to minimize database writes
- Added proper cleanup and resource management
- Used React Native Chart Kit for data visualization
- Created responsive UI for all screen sizes

## Testing Instructions
1. In the Profile screen, test changing currency preference and verify prices update accordingly
2. As an admin user, access the Analytics Dashboard from the Admin Dashboard
3. Test user profile editing (name, avatar, etc.)
4. Verify that searching, viewing foods, and food recognition are properly tracked in analytics

## Next Steps
These enhancements position the application for further improvements in:
- Machine learning model refinement using analytics data
- Internationalization and localization
- User-generated content features
- Social login integration 