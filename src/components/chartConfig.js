import { Chart as ChartJS, CategoryScale,   LinearScale, PointElement, LineElement,  BarElement, Tooltip,  Legend,   Title, ArcElement, } from 'chart.js';

ChartJS.register( ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Title);  
