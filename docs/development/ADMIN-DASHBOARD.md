> Historical implementation notes. For current installation and configuration, see [README](../../README.md). Some described behavior is experimental.

# Admin Dashboard

The Admin Dashboard provides powerful tools for managing your Food Culture Guide application.

## Features

1. **Dashboard Overview**
   - View key metrics (total dishes, active users, premium subscribers, total reviews)
   - Track user growth and engagement at a glance

2. **User Management**
   - View all users in the system
   - Edit user details
   - Delete users when necessary
   - Grant or revoke admin privileges

3. **Restaurant Approval**
   - Review and approve or reject restaurant submissions
   - Maintain quality control over restaurant listings

## How to Use

### Setting Admin Status

To make a user an admin:
1. Find the user in the user list
2. Click the shield icon to toggle admin status
3. Confirm the action when prompted

### Editing User Details

To edit a user's information:
1. Find the user in the user list
2. Click the edit (pencil) icon
3. Update the user's name and email
4. Save your changes

### Deleting Users

To delete a user:
1. Find the user in the user list
2. Click the delete (trash) icon
3. Confirm the action when prompted

### Managing Restaurants

To approve or reject a restaurant:
1. Scroll to the "Pending Restaurants" section
2. Review the restaurant details
3. Click "Approve" or "Reject" as appropriate

## Access Control

The Admin Dashboard is only accessible to users with admin privileges. If you need admin access:

1. Contact an existing admin to grant you access, or
2. Use the initial admin setup process (see ADMIN_SETUP.md)

## Troubleshooting

If you encounter issues with the Admin Dashboard:

1. Verify you have admin privileges
2. Try logging out and logging back in
3. Check your internet connection
4. Consult the Firebase console for any backend errors 