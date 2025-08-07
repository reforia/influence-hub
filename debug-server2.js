console.log('🔍 Debug: Testing with ConnectorFactory...');

require('dotenv').config();
const express = require('express');

try {
  console.log('🔍 Debug: Loading modules...');
  const { TokenManager } = require('./dist/auth/tokenManager');
  const { ConnectorFactory } = require('./dist/connectors');
  const { AnalyticsAggregator } = require('./dist/analytics/aggregator');
  
  console.log('🔍 Debug: Creating instances...');
  const tokenManager = new TokenManager();
  const connectorFactory = new ConnectorFactory();
  const aggregator = new AnalyticsAggregator();
  
  console.log('🔍 Debug: Testing setupConnectors logic...');
  
  function setupConnectors() {
    const configuredPlatforms = tokenManager.listConfiguredPlatforms();
    console.log('🔍 Debug: Configured platforms:', configuredPlatforms);
    
    configuredPlatforms.forEach(platform => {
      console.log(`🔍 Debug: Setting up ${platform}...`);
      
      const credentials = tokenManager.getCredentials(platform);
      if (credentials) {
        console.log(`🔍 Debug: Got credentials for ${platform}`);
        
        try {
          const connector = connectorFactory.createConnector(platform, credentials);
          if (connector) {
            console.log(`🔍 Debug: Created connector for ${platform}`);
            aggregator.addConnector(platform, connector);
            console.log(`✓ Connected to ${platform}`);
          } else {
            console.log(`⚠️ No connector created for ${platform}`);
          }
        } catch (error) {
          console.error(`❌ Failed to setup connector for ${platform}:`, error.message);
          console.error('❌ Full error:', error);
        }
      } else {
        console.log(`⚠️ No credentials for ${platform}`);
      }
    });
  }
  
  setupConnectors();
  
  console.log('✅ Debug: Setup completed successfully');
  
} catch (error) {
  console.error('❌ Debug: Error in setup:', error.message);
  console.error('❌ Debug: Full error:', error);
}

console.log('🔍 Debug: Script completed');