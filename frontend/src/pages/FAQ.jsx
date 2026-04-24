import React, { useState } from 'react';
import { Link } from 'react-router-dom';

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      category: "For Home Buyers/Sellers",
      questions: [
        {
          q: "How does HomeMatch AI work?",
          a: "HomeMatch AI uses advanced artificial intelligence to match you with the perfect real estate agent based on your specific needs, location, and property preferences. Simply fill out our quick form, and we'll connect you with qualified agents in your area."
        },
        {
          q: "Is the service free for home buyers and sellers?",
          a: "Yes! Our service is completely free for home buyers and sellers. We only charge real estate agents for the leads they receive."
        },
        {
          q: "How quickly will I hear from an agent?",
          a: "Typically within 24 hours. Our AI matches you with agents in real-time, and they are notified immediately. Most agents reach out within a few hours."
        },
        {
          q: "Can I choose which agent to work with?",
          a: "Yes! We may match you with multiple qualified agents. You're free to interview them and choose the one you feel most comfortable working with."
        },
        {
          q: "What information do I need to provide?",
          a: "We ask for basic information about your property needs, location, timeline, and contact details. This helps us match you with the most suitable agents."
        }
      ]
    },
    {
      category: "For Real Estate Agents",
      questions: [
        {
          q: "How do I join HomeMatch AI?",
          a: "Click on 'Join Our Network' and complete the registration process. You'll need to provide your license information, brokerage details, and service area. All applications are reviewed for quality assurance."
        },
        {
          q: "How much do leads cost?",
          a: "Pricing varies based on lead quality and your location. We offer both pay-per-lead and subscription packages. Contact us for specific pricing in your area."
        },
        {
          q: "How does the AI scoring work?",
          a: "Our AI evaluates multiple factors including buyer readiness, property specifics, timeline, financing status, and more to provide a quality score for each lead. Higher scores indicate more qualified, ready-to-act clients."
        },
        {
          q: "What if a lead doesn't convert?",
          a: "We focus on lead quality. If a lead's contact information is inaccurate or unresponsive, reach out to your broker for support."
        }
      ]
    },
    {
      category: "Technical & Account",
      questions: [
        {
          q: "How do I reset my password?",
          a: "Click 'Forgot Password' on the login page. You'll receive an email with instructions to reset your password."
        },
        {
          q: "Can I update my service area or preferences?",
          a: "Yes! Log into your dashboard and navigate to 'Profile Settings' to update your service areas, lead preferences, and notification settings."
        },
        {
          q: "How do I cancel my subscription?",
          a: "You can cancel anytime from your account settings. Your subscription will remain active until the end of your billing period."
        },
        {
          q: "What payment methods do you accept?",
          a: "We accept all major credit cards and debit cards. Payments are processed securely through our payment processor."
        }
      ]
    },
    {
      category: "Privacy & Security",
      questions: [
        {
          q: "How is my information protected?",
          a: "We use industry-standard encryption and security measures to protect your data. All information is stored securely on AWS servers. View our Privacy Policy for more details."
        },
        {
          q: "Who has access to my contact information?",
          a: "For home buyers/sellers: Only matched real estate agents receive your contact information. For agents: Your information is visible to potential clients browsing agent profiles."
        },
        {
          q: "Can I delete my account?",
          a: "Yes. Contact our support team, and we'll permanently delete your account and associated data within 30 days."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Link to="/" className="inline-flex items-center text-primary-600 hover:text-primary-700 mb-8">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Home
        </Link>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-gray-600">Find answers to common questions about HomeMatch AI</p>
        </div>

        {faqs.map((category, categoryIndex) => (
          <div key={categoryIndex} className="mb-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">{category.category}</h2>
            <div className="bg-white rounded-lg shadow-sm divide-y divide-gray-200">
              {category.questions.map((faq, index) => {
                const globalIndex = `${categoryIndex}-${index}`;
                const isOpen = openIndex === globalIndex;
                
                return (
                  <div key={index} className="p-6">
                    <button
                      onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                      className="w-full flex justify-between items-start text-left"
                    >
                      <span className="font-semibold text-gray-900 pr-4">{faq.q}</span>
                      <svg
                        className={`w-5 h-5 text-primary-600 flex-shrink-0 transition-transform ${
                          isOpen ? 'transform rotate-180' : ''
                        }`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    {isOpen && (
                      <div className="mt-4 text-gray-600 leading-relaxed">
                        {faq.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div className="bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg p-8 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-4">Still have questions?</h3>
          <p className="text-gray-700 mb-6">
            Can't find what you're looking for? Our support team is here to help.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center bg-primary-600 hover:bg-primary-700 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
          >
            Contact Support
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
