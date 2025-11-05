import React from 'react';
import './AdminDashboard.css';

function AdminDashboard() {
  return (
    <div className="container admin-dashboard">
      <h1>Admin Dashboard</h1>
      <p className="subtitle">Platform administration and analytics</p>

      <div className="alert alert-info">
        <strong>Coming Soon!</strong> Admin dashboard features are under development.
      </div>

      <div className="grid grid-3">
        <div className="card">
          <h3>Leads Management</h3>
          <p>View and manage all leads in the system.</p>
          <button className="btn btn-outline" disabled>View Leads</button>
        </div>

        <div className="card">
          <h3>Agent Management</h3>
          <p>Manage agent accounts and permissions.</p>
          <button className="btn btn-outline" disabled>View Agents</button>
        </div>

        <div className="card">
          <h3>Transactions</h3>
          <p>View payment history and process refunds.</p>
          <button className="btn btn-outline" disabled>View Transactions</button>
        </div>
      </div>

      <div className="card">
        <h3>Platform Analytics</h3>
        <p>Comprehensive analytics dashboard will be available here including:</p>
        <ul>
          <li>Total revenue and transaction metrics</li>
          <li>Lead conversion rates by score</li>
          <li>Agent performance metrics</li>
          <li>Geographic distribution analysis</li>
          <li>AI scoring accuracy tracking</li>
        </ul>
      </div>
    </div>
  );
}

export default AdminDashboard;
