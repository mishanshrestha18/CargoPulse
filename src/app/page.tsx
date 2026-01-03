import AddLocationForm from './components/AddLocationForm';
import LocationList from '@/components/LocationList';

export default function Home() {
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">Logistics Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

        {/* Left Column: Input Form */}
        <div>
          <h2 className="text-xl font-semibold mb-4 text-gray-800">Add New Node</h2>
          <AddLocationForm />
        </div>

        {/* Right Column: Location List */}
        <div>
          <LocationList />
        </div>

      </div>
    </div>
  );
}