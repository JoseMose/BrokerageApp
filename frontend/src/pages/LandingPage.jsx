import React, { useState } from 'react';
import LeadForm from '../components/LeadForm';
import DifferenceSection from '../components/DifferenceSection';

const LandingPage = () => {
  const [showForm, setShowForm] = useState(false);
  const [leadType, setLeadType] = useState(null);

  if (showForm && leadType) {
    return <LeadForm initialLeadType={leadType} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-blue-50">
      {/* Top Navigation Bar */}
      <nav className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <span className="text-2xl font-bold bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                HomeMatch AI
              </span>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/realtor-login"
                className="text-gray-700 hover:text-primary-600 font-medium transition-colors"
              >
                Realtor Sign In
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 via-transparent to-secondary-500/10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-32">
          <div className="text-center">
            <div className="inline-flex items-center gap-2 bg-primary-100 text-primary-700 px-4 py-2 rounded-full text-sm font-semibold mb-8">
              <span>🤖 AI-Powered Matching</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-bold text-gray-900 mb-6">
              Find a Realtor Who's{' '}
              <span className="bg-gradient-to-r from-primary-500 to-secondary-500 bg-clip-text text-transparent">
                Ready to Work for You
              </span>
            </h1>

            <p className="text-xl md:text-2xl text-gray-600 mb-16 max-w-3xl mx-auto">
              Our AI system matches you with an agent based on{' '}
              <strong className="text-gray-900">readiness, fairness, and fit</strong>
              {' '}— not who pays the most.
            </p>

            {/* Inline First Form Step - Buy/Sell Selection */}
            <div className="max-w-2xl mx-auto">
              {/* Trust Reassurance */}
              <div className="text-center mb-8 animate-fade-in">
                <p className="text-base text-gray-600 font-medium">
                  Free to use. You'll only be matched with ONE local realtor — no spam, no pressure.
                </p>
              </div>

              {/* First Question */}
              <div className="text-center mb-8">
                <h2 className="text-3xl md:text-4xl font-bold text-navy mb-2">
                  What are you looking to do today?
                </h2>
              </div>

              {/* Buy/Sell Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                <button
                  onClick={() => {
                    setLeadType('buyer');
                    setShowForm(true);
                  }}
                  className="p-10 rounded-2xl border-2 border-gray-300 bg-white hover:border-electric hover:bg-electric-50 hover:shadow-xl hover:scale-102 transition-all duration-300 animate-fade-in"
                  style={{animationDelay: '200ms'}}
                >
                  <div className="text-6xl mb-4">🏠</div>
                  <h3 className="text-2xl font-bold text-navy mb-2">Buy a home</h3>
                  <p className="text-sm text-gray-600">Find your dream property</p>
                </button>

                <button
                  onClick={() => {
                    setLeadType('seller');
                    setShowForm(true);
                  }}
                  className="p-10 rounded-2xl border-2 border-gray-300 bg-white hover:border-electric hover:bg-electric-50 hover:shadow-xl hover:scale-102 transition-all duration-300 animate-fade-in"
                  style={{animationDelay: '300ms'}}
                >
                  <div className="text-6xl mb-4">🏡</div>
                  <h3 className="text-2xl font-bold text-navy mb-2">Sell a home</h3>
                  <p className="text-sm text-gray-600">Get the best value</p>
                </button>
              </div>

              {/* Trust Indicators Below Buttons */}
              <div className="flex flex-wrap justify-center gap-8 text-sm text-gray-600 animate-fade-in" style={{animationDelay: '400ms'}}>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>100% Free</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>No Obligation</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Verified Realtors</strong></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Difference Section - Why We're Different */}
      <DifferenceSection />

      {/* How Our AI Works Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              How Our Smart Matching System Works
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Our AI-powered platform ensures you get connected with the right agent,
              at the right time, for the right reasons.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">1. Analyze</h3>
              <p className="text-gray-600 text-center">
                We review your goals, timeline, and specific needs through a simple questionnaire.
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">2. Match</h3>
              <p className="text-gray-600 text-center">
                AI scores your readiness from 1-10 and intelligently pairs you with the best available agent.
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
              <div className="flex justify-center mb-6">
                <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-green-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3 text-center">3. Connect</h3>
              <p className="text-gray-600 text-center">
                We instantly connect you with a top-rated agent who's ready and excited to help you.
              </p>
            </div>
          </div>

          <div className="bg-gradient-to-r from-primary-500 to-secondary-500 rounded-2xl p-8 shadow-2xl">
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 text-white">
              <div className="text-5xl">🤖</div>
              <div className="text-center md:text-left">
                <h3 className="text-2xl font-bold mb-2">AI-Powered Quality Control</h3>
                <p className="text-white/90">
                  Only serious, qualified leads are shared with agents, ensuring you get the attention and service you deserve.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary-500 to-secondary-500">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Find Your Perfect Agent?
          </h2>
          <p className="text-xl text-white/90 mb-10">
            It takes less than 2 minutes to get matched with a top-rated realtor in your area.
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="group inline-flex items-center gap-3 bg-white hover:bg-gray-50 text-primary-600 font-bold text-lg px-10 py-5 rounded-2xl transition-all duration-300 transform hover:scale-105 shadow-2xl"
          >
            <span>Get Started Now</span>
            <svg className="w-6 h-6 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            {/* Company Info */}
            <div className="col-span-1">
              <div className="flex items-center mb-4">
                <span className="text-2xl font-bold text-white">
                  HomeMatch AI
                </span>
              </div>
              <p className="text-sm text-gray-400">
                Connecting home buyers and sellers with the perfect real estate agents through AI-powered matching.
              </p>
            </div>

            {/* Legal */}
            <div>
              <h3 className="text-white font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/privacy-policy" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="/terms-of-service" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="/cookie-policy" className="hover:text-white transition-colors">
                    Cookie Policy
                  </a>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h3 className="text-white font-semibold mb-4">Support</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/contact" className="hover:text-white transition-colors">
                    Contact Us
                  </a>
                </li>
                <li>
                  <a href="/faq" className="hover:text-white transition-colors">
                    FAQ
                  </a>
                </li>
                <li>
                  <a href="/help" className="hover:text-white transition-colors">
                    Help Center
                  </a>
                </li>
              </ul>
            </div>

            {/* For Realtors */}
            <div>
              <h3 className="text-white font-semibold mb-4">For Realtors</h3>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="/realtor-login" className="hover:text-white transition-colors">
                    Realtor Login
                  </a>
                </li>
                <li>
                  <a href="/realtor-signup" className="hover:text-white transition-colors">
                    Join Our Network
                  </a>
                </li>
                <li>
                  <a href="/how-it-works" className="hover:text-white transition-colors">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm text-gray-400">
            <p>© {new Date().getFullYear()} HomeMatch AI. All rights reserved.</p>
            <div className="flex gap-6 mt-4 md:mt-0">
              <a href="https://facebook.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Facebook
              </a>
              <a href="https://twitter.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                Twitter
              </a>
              <a href="https://linkedin.com" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                LinkedIn
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
