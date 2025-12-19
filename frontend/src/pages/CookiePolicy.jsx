import React from 'react';
import { Link } from 'react-router-dom';

const CookiePolicy = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-8">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Cookie Policy</h1>
          <p className="text-gray-500 mb-8">Last updated: December 18, 2025</p>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">What Are Cookies?</h2>
            <p className="text-gray-700 mb-6">
              Cookies are small text files that are placed on your device when you visit our website. They help us provide you with a better experience by remembering your preferences and understanding how you use our services.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">How We Use Cookies</h2>
            <p className="text-gray-700 mb-4">
              We use cookies for the following purposes:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Essential Cookies</h3>
            <p className="text-gray-700 mb-4">
              These cookies are necessary for the website to function properly:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Authentication and security</li>
              <li>Session management</li>
              <li>Load balancing</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Analytics Cookies</h3>
            <p className="text-gray-700 mb-4">
              We use analytics cookies to understand how visitors interact with our website:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Page views and navigation patterns</li>
              <li>Time spent on pages</li>
              <li>Traffic sources</li>
              <li>Error tracking</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Functional Cookies</h3>
            <p className="text-gray-700 mb-4">
              These cookies enable enhanced functionality:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Remembering your preferences</li>
              <li>Saving form data</li>
              <li>Personalizing your experience</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Marketing Cookies</h3>
            <p className="text-gray-700 mb-4">
              With your consent, we may use marketing cookies to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Display relevant advertisements</li>
              <li>Track ad campaign performance</li>
              <li>Retarget website visitors</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Third-Party Cookies</h2>
            <p className="text-gray-700 mb-4">
              We use services from third-party providers that may place cookies on your device:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li><strong>AWS Amplify:</strong> For authentication and hosting</li>
              <li><strong>Analytics Services:</strong> To understand website usage</li>
              <li><strong>Payment Processors:</strong> For secure payment processing</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Managing Cookies</h2>
            <p className="text-gray-700 mb-4">
              You can control and manage cookies in several ways:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Browser Settings</h3>
            <p className="text-gray-700 mb-4">
              Most browsers allow you to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>View and delete cookies</li>
              <li>Block third-party cookies</li>
              <li>Block all cookies</li>
              <li>Clear cookies when you close the browser</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">Opt-Out Tools</h3>
            <p className="text-gray-700 mb-6">
              You can opt out of targeted advertising through industry opt-out platforms or by adjusting your privacy settings in our cookie consent banner.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Impact of Disabling Cookies</h2>
            <p className="text-gray-700 mb-4">
              If you disable cookies, some features may not work properly:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>You may not be able to log in or stay logged in</li>
              <li>Your preferences won't be saved</li>
              <li>Some pages may not display correctly</li>
              <li>Certain features may be unavailable</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Updates to This Policy</h2>
            <p className="text-gray-700 mb-6">
              We may update this Cookie Policy from time to time to reflect changes in our practices or for legal reasons. We will notify you of any material changes by updating the "Last updated" date at the top of this page.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">Contact Us</h2>
            <p className="text-gray-700 mb-4">
              If you have questions about our use of cookies, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-gray-700">
                <strong>Email:</strong> privacy@homematchai.net<br />
                <strong>Address:</strong> HomeMatch AI, [Your Business Address]
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookiePolicy;
