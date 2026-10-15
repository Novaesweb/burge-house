import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ConnectProvider } from './context/ConnectContext';

createRoot(document.getElementById('root')!).render(<ConnectProvider><App /></ConnectProvider>);


