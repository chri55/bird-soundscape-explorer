import { Switch, Route } from 'wouter';
import MapView from './components/MapView';

export default function App() {
  return (
    <Switch>
      <Route path="/" component={MapView} />
    </Switch>
  );
}
