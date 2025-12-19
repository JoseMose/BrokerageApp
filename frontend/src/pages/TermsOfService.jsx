import React from 'react';
import { Link } from 'react-router-dom';

const TermsOfService = () => {
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
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Terms of Service</h1>
          <p className="text-gray-500 mb-8">Last updated: December 18, 2025</p>

          <div className="prose prose-lg max-w-none">
            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">1. Acceptance of Terms</h2>
            <p className="text-gray-700 mb-6">
              By accessing or using HomeMatch AI's services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">2. Description of Service</h2>
            <p className="text-gray-700 mb-4">
              HomeMatch AI provides an AI-powered platform that connects home buyers and sellers with qualified real estate agents. Our services include:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Lead generation and matching services</li>
              <li>Agent marketplace and lead distribution</li>
              <li>AI-powered scoring and recommendations</li>
              <li>Communication facilitation between clients and agents</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">3. User Accounts</h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Home Buyers/Sellers</h3>
            <p className="text-gray-700 mb-4">
              When you submit a lead form, you agree to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Provide accurate and complete information</li>
              <li>Be contacted by matched real estate agents</li>
              <li>Use the service for legitimate home buying or selling purposes</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mt-6 mb-3">For Real Estate Agents</h3>
            <p className="text-gray-700 mb-4">
              By registering as an agent, you represent and warrant that you:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Hold a valid real estate license in your jurisdiction</li>
              <li>Are in good standing with your licensing authority</li>
              <li>Will comply with all applicable real estate laws and regulations</li>
              <li>Will maintain professional conduct when contacting leads</li>
              <li>Are authorized to purchase leads on behalf of your brokerage</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">4. Payment Terms</h2>
            <p className="text-gray-700 mb-4">
              For real estate agents:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Leads are sold on a pay-per-lead or subscription basis</li>
              <li>All payments are processed securely through third-party payment processors</li>
              <li>Fees are non-refundable unless otherwise stated in our refund policy</li>
              <li>You are responsible for all taxes associated with your purchases</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">5. Lead Quality and Disputes</h2>
            <p className="text-gray-700 mb-4">
              Regarding lead quality:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>We use AI to score and match leads, but cannot guarantee conversion rates</li>
              <li>Leads are provided on an "as-is" basis</li>
              <li>Dispute requests must be submitted within 48 hours of lead receipt</li>
              <li>We reserve the right to review and resolve disputes at our discretion</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">6. Prohibited Activities</h2>
            <p className="text-gray-700 mb-4">
              You agree not to:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>Use the service for any illegal or unauthorized purpose</li>
              <li>Harass, abuse, or harm other users</li>
              <li>Submit false or misleading information</li>
              <li>Attempt to circumvent our matching or payment systems</li>
              <li>Scrape, copy, or redistribute our content without permission</li>
              <li>Interfere with or disrupt the service</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">7. Intellectual Property</h2>
            <p className="text-gray-700 mb-6">
              All content, features, and functionality on HomeMatch AI, including but not limited to text, graphics, logos, software, and AI algorithms, are owned by HomeMatch AI and protected by copyright, trademark, and other intellectual property laws.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">8. Disclaimers and Limitations of Liability</h2>
            <p className="text-gray-700 mb-4">
              THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. TO THE MAXIMUM EXTENT PERMITTED BY LAW:
            </p>
            <ul className="list-disc pl-6 text-gray-700 mb-6">
              <li>We do not guarantee the accuracy, completeness, or usefulness of any information</li>
              <li>We are not responsible for the actions of real estate agents or clients</li>
              <li>We are not liable for any indirect, incidental, or consequential damages</li>
              <li>Our total liability shall not exceed the amount you paid us in the past 12 months</li>
            </ul>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">9. Indemnification</h2>
            <p className="text-gray-700 mb-6">
              You agree to indemnify and hold harmless HomeMatch AI from any claims, damages, or expenses arising from your use of the service or violation of these terms.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">10. Termination</h2>
            <p className="text-gray-700 mb-6">
              We reserve the right to suspend or terminate your access to the service at any time for any reason, including violation of these terms. Upon termination, your right to use the service will immediately cease.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">11. Governing Law</h2>
            <p className="text-gray-700 mb-6">
              These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">12. Changes to Terms</h2>
            <p className="text-gray-700 mb-6">
              We may modify these Terms at any time. We will notify you of material changes by posting the updated terms on this page. Your continued use of the service constitutes acceptance of the modified terms.
            </p>

            <h2 className="text-2xl font-semibold text-gray-900 mt-8 mb-4">13. Contact Information</h2>
            <p className="text-gray-700 mb-4">
              For questions about these Terms, please contact us:
            </p>
            <div className="bg-gray-50 p-4 rounded-lg mb-6">
              <p className="text-gray-700">
                <strong>Email:</strong> legal@homematchai.net<br />
                <strong>Address:</strong> HomeMatch AI, [Your Business Address]
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TermsOfService;
