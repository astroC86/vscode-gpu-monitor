import React from 'react';
import ReactDOM from 'react-dom';
import MonitorDashboard from './components/MonitorDashboard';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

console.log('Webview index.tsx starting...');

try {
    console.log('Attempting to render React app...');
    
    ReactDOM.render(
        <React.StrictMode>
            <ErrorBoundary>
                <MonitorDashboard />
            </ErrorBoundary>
        </React.StrictMode>,
        document.getElementById('root'),
        () => {
            console.log('React render completed');
        }
    );
} catch (error) {
    console.error('Error during React initialization:', error);
}