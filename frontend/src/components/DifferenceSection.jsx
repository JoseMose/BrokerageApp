import React from 'react';
import './DifferenceSection.css';

function DifferenceSection() {
  const differences = [
    {
      icon: '🚫',
      title: 'We Don\'t Spam You',
      description: 'No more getting your phone blown up by 10+ agents. You get matched with ONE qualified realtor who actually wants to work with you.',
      accentColor: 'emerald'
    },
    {
      icon: '⚖️',
      title: 'AI Fairness Scoring',
      description: 'Our AI scores leads based on readiness and fit—not who pays the most. Fair matching for serious buyers and sellers.',
      accentColor: 'electric'
    },
    {
      icon: '🤝',
      title: 'Agents Who Want You',
      description: 'Realtors bid on leads they actually want to close. No random assignments. Just motivated agents ready to deliver results.',
      accentColor: 'amber'
    }
  ];

  return (
    <section className="relative py-20 px-4 bg-gradient-to-br from-navy via-navy-700 to-navy-900 overflow-hidden">
      {/* Background pattern overlay */}
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}></div>
      </div>

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header */}
        <div className="text-center mb-16 animate-fade-in">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Why We're Different From <span className="text-electric">Zillow</span> & <span className="text-electric">Realtor.com</span>
          </h2>
          <div className="w-24 h-1 bg-gradient-to-r from-electric to-emerald mx-auto mb-6 rounded-full"></div>
          <p className="text-pearl-300 text-lg md:text-xl max-w-3xl mx-auto">
            Stop getting bombarded by dozens of agents. We match you with ONE realtor who's actually invested in your success.
          </p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {differences.map((item, index) => (
            <div
              key={index}
              className="group relative bg-pearl/5 backdrop-blur-sm border border-pearl/10 rounded-2xl p-8 hover:bg-pearl/10 hover:border-electric/30 hover:shadow-2xl hover:shadow-electric/10 transition-all duration-300 hover:-translate-y-2 animate-slide-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-xl bg-gradient-to-br from-${item.accentColor} to-${item.accentColor}-600 mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                <span className="text-4xl">{item.icon}</span>
              </div>

              {/* Content */}
              <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-electric transition-colors duration-300">
                {item.title}
              </h3>
              <p className="text-pearl-300 leading-relaxed">
                {item.description}
              </p>

              {/* Accent line at bottom */}
              <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-${item.accentColor} to-${item.accentColor}-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 rounded-b-2xl`}></div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="text-center mt-16 animate-fade-in" style={{ animationDelay: '400ms' }}>
          <p className="text-pearl-200 text-lg font-medium">
            Ready to skip the spam and work with a realtor who cares?
          </p>
        </div>
      </div>
    </section>
  );
}

export default DifferenceSection;
