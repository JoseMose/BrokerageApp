import React from 'react';
import { Link } from 'react-router-dom';

const HowItWorks = () => {
  const steps = {
    buyers: [
      {
        number: "1",
        title: "Tell Us What You Need",
        description: "Fill out a quick form about your home buying or selling needs, including location, budget, and timeline."
      },
      {
        number: "2",
        title: "Get Matched Instantly",
        description: "Our AI analyzes your requirements and matches you with the best real estate agents in your area."
      },
      {
        number: "3",
        title: "Connect with Agents",
        description: "Qualified agents reach out to you within 24 hours. Interview them and choose the one you like best."
      },
      {
        number: "4",
        title: "Find Your Dream Home",
        description: "Work with your chosen agent to find the perfect property or sell your home at the best price."
      }
    ],
    agents: [
      {
        number: "1",
        title: "Sign Up & Get Verified",
        description: "Create your profile and verify your real estate license. We ensure all agents meet our quality standards."
      },
      {
        number: "2",
        title: "Set Your Preferences",
        description: "Define your service areas, specialties, and lead preferences. Our AI uses this to match you with the right clients."
      },
      {
        number: "3",
        title: "Receive Quality Leads",
        description: "Get notified of high-quality leads matched to your expertise. Review AI scores and claim the ones you want."
      },
      {
        number: "4",
        title: "Close More Deals",
        description: "Connect with pre-qualified, motivated clients and grow your business with less effort."
      }
    ]
  };

  const benefits = {
    buyers: [
      { icon: "🎯", title: "Perfect Matches", description: "AI-powered matching finds agents who specialize in your needs" },
      { icon: "⚡", title: "Fast Connections", description: "Get connected with agents in minutes, not days" },
      { icon: "🆓", title: "Completely Free", description: "No cost to you - ever. Agents pay for the service" },
      { icon: "✅", title: "Verified Agents", description: "All agents are licensed and verified professionals" }
    ],
    agents: [
      { icon: "📊", title: "Quality Over Quantity", description: "AI-scored leads help you focus on the best opportunities" },
      { icon: "💰", title: "Flexible Pricing", description: "Pay-per-lead or subscription plans that fit your business" },
      { icon: "🎯", title: "Better Targeting", description: "Only receive leads that match your expertise and service area" },
      { icon: "📈", title: "Grow Your Business", description: "Spend less time prospecting, more time closing deals" }
    ]
  };

  const [activeTab, setActiveTab] = React.useState('buyers');

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link to="/" className="inline-flex items-center text-white hover:text-gray-200 mb-8">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Home
          </Link>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">How HomeMatch AI Works</h1>
          <p className="text-xl text-primary-100">AI-powered matching that connects the right people at the right time</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            <button
              onClick={() => setActiveTab('buyers')}
              className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
                activeTab === 'buyers'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              For Home Buyers & Sellers
            </button>
            <button
              onClick={() => setActiveTab('agents')}
              className={`py-4 px-6 font-semibold border-b-2 transition-colors ${
                activeTab === 'agents'
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              For Real Estate Agents
            </button>
          </div>
        </div>
      </div>

      {/* Steps Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            {activeTab === 'buyers' ? 'Finding Your Perfect Agent' : 'Growing Your Business'}
          </h2>
          <p className="text-xl text-gray-600">
            {activeTab === 'buyers' 
              ? 'Get matched with top agents in just 4 simple steps'
              : 'Start receiving quality leads in 4 easy steps'
            }
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
          {steps[activeTab].map((step, index) => (
            <div key={index} className="relative">
              {index < steps[activeTab].length - 1 && (
                <div className="hidden lg:block absolute top-16 left-[calc(50%+2rem)] w-full h-0.5 bg-gradient-to-r from-primary-300 to-transparent"></div>
              )}
              <div className="bg-white rounded-lg shadow-sm p-6 relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-primary-500 to-primary-700 rounded-full flex items-center justify-center text-white text-2xl font-bold mb-4 mx-auto">
                  {step.number}
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3 text-center">{step.title}</h3>
                <p className="text-gray-600 text-center">{step.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Benefits Section */}
        <div className="bg-white rounded-lg shadow-sm p-8 md:p-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-8 text-center">
            Why Choose HomeMatch AI?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits[activeTab].map((benefit, index) => (
              <div key={index} className="text-center">
                <div className="text-5xl mb-4">{benefit.icon}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{benefit.title}</h3>
                <p className="text-gray-600">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>

        {/* AI Technology Section */}
        <div className="mt-16 bg-gradient-to-br from-primary-50 to-secondary-50 rounded-lg p-8 md:p-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Powered by Advanced AI</h2>
            <p className="text-xl text-gray-700">
              Our matching algorithm considers dozens of factors to ensure the perfect fit
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-lg p-6">
              <div className="text-primary-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Lead Scoring</h3>
              <p className="text-gray-600 text-center">
                Each lead is scored based on readiness, budget, timeline, and other factors
              </p>
            </div>

            <div className="bg-white rounded-lg p-6">
              <div className="text-primary-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Smart Matching</h3>
              <p className="text-gray-600 text-center">
                Location, specialization, experience, and client preferences all factored in
              </p>
            </div>

            <div className="bg-white rounded-lg p-6">
              <div className="text-primary-600 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2 text-center">Real-Time Processing</h3>
              <p className="text-gray-600 text-center">
                Instant matching and notifications so no opportunity is missed
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">
            {activeTab === 'buyers' ? 'Ready to Find Your Agent?' : 'Ready to Grow Your Business?'}
          </h2>
          <Link
            to={activeTab === 'buyers' ? '/' : '/realtor-signup'}
            className="inline-flex items-center bg-primary-600 hover:bg-primary-700 text-white font-semibold px-8 py-4 rounded-lg text-lg transition-colors"
          >
            {activeTab === 'buyers' ? 'Get Started - It\'s Free' : 'Join Our Network'}
            <svg className="w-5 h-5 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowItWorks;
