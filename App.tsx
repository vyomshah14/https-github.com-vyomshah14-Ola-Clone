
import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Navigation, Car, CreditCard, Star, Clock, User as UserIcon, ChevronLeft, ShieldCheck, Zap, Bike, ArrowRight, Smartphone, Banknote, Loader2, CheckCircle2, Mail, Lock } from 'lucide-react';
import MapComponent from './components/MapComponent';
import { AppStep, Location, VehicleOption, RideType, Coordinates } from './types';
import { getAddressSuggestions, calculateFares, getAddressFromCoordinates } from './services/geminiService';

const App = () => {
  const [step, setStep] = useState<AppStep>(AppStep.LOGIN);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [userName, setUserName] = useState('');
  
  const [pickup, setPickup] = useState<Location | null>(null);
  const [dropoff, setDropoff] = useState<Location | null>(null);
  
  const [pickupSearch, setPickupSearch] = useState('');
  const [dropoffSearch, setDropoffSearch] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSearchField, setActiveSearchField] = useState<'pickup' | 'dropoff' | null>(null);

  const [vehicles, setVehicles] = useState<VehicleOption[]>([]);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleOption | null>(null);
  const [loadingFares, setLoadingFares] = useState(false);
  
  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CARD' | 'CASH'>('UPI');

  // Real-time ride ETA state
  const [rideEtaSeconds, setRideEtaSeconds] = useState<number>(0);
  const [driverLocation, setDriverLocation] = useState<{lat: number, lng: number} | null>(null);

  // Simulated User Location
  const [userCoords, setUserCoords] = useState<{lat: number, lng: number} | null>(null);

  // To track driver movement loop
  const driverIntervalRef = useRef<any>(null);

  // Initialize Geolocation
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Got location", position.coords);
          setUserCoords({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.log("Geo error:", error);
          // Fallback to Bangalore
          setUserCoords({ lat: 12.9716, lng: 77.5946 });
        }
      );
    }
  }, []);

  // --- Handlers ---

  const handleLogin = () => {
    if (email && password) {
      // Simulate Login: derive name from email
      const namePart = email.split('@')[0];
      const formattedName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
      setUserName(formattedName);
      setStep(AppStep.LOCATION_SELECT);
    }
  };

  const handleUseCurrentLocation = () => {
    if (userCoords) {
      const loc: Location = {
        name: "Current Location",
        coords: userCoords,
        type: 'current'
      };
      setPickup(loc);
      setPickupSearch("Current Location");
    }
  };

  const handleMapClick = async (coords: Coordinates) => {
    if (step !== AppStep.LOCATION_SELECT) return;

    // Determine which field to update
    let targetField = 'pickup';
    if (activeSearchField === 'dropoff') {
        targetField = 'dropoff';
    } else if (activeSearchField === 'pickup') {
        targetField = 'pickup';
    } else if (pickup) {
        // If pickup is already set and user just clicks map, assume they want to set dropoff
        targetField = 'dropoff';
    }

    const tempLocation: Location = {
        name: "Fetching address...",
        coords: coords,
        type: 'selected'
    };

    // Optimistic update
    if (targetField === 'pickup') {
        setPickup(tempLocation);
        setPickupSearch("Fetching address...");
    } else {
        setDropoff(tempLocation);
        setDropoffSearch("Fetching address...");
    }
    
    // Clear active search so suggestions don't pop up for "Fetching address..."
    setActiveSearchField(null);

    // Fetch actual address
    const address = await getAddressFromCoordinates(coords.lat, coords.lng);
    
    const finalLocation: Location = {
        name: address,
        coords: coords,
        type: 'selected'
    };

    if (targetField === 'pickup') {
        setPickup(finalLocation);
        setPickupSearch(address);
    } else {
        setDropoff(finalLocation);
        setDropoffSearch(address);
    }
  };

  // Debounced Search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (activeSearchField && (pickupSearch.length > 2 || dropoffSearch.length > 2)) {
        const query = activeSearchField === 'pickup' ? pickupSearch : dropoffSearch;
        // Don't search if it's "Current Location" or temp placeholder
        if (query === "Current Location" || query === "Fetching address...") return;
        
        // Use user location as context for better search results
        const locationContext = userCoords ? `${userCoords.lat}, ${userCoords.lng}` : "Bangalore, India";
        const results = await getAddressSuggestions(query, locationContext);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [pickupSearch, dropoffSearch, activeSearchField, userCoords]);

  const selectAddress = (address: string) => {
    // Generate a pseudo-random coordinate near the user/center for demo purposes
    const baseLat = userCoords?.lat || 12.9716;
    const baseLng = userCoords?.lng || 77.5946;
    
    // Add randomness to simulate different locations around the user
    const randomOffset = () => (Math.random() - 0.5) * 0.05; 

    const location: Location = {
      name: address,
      coords: {
        lat: baseLat + randomOffset(),
        lng: baseLng + randomOffset()
      },
      type: 'selected'
    };

    if (activeSearchField === 'pickup') {
      setPickup(location);
      setPickupSearch(address);
    } else {
      setDropoff(location);
      setDropoffSearch(address);
    }
    setSuggestions([]);
    setActiveSearchField(null);
  };

  const handleFindRides = async () => {
    if (pickup && dropoff) {
        setLoadingFares(true);
        setStep(AppStep.VEHICLE_SELECT);
        const options = await calculateFares(pickup.name, dropoff.name);
        setVehicles(options);
        setLoadingFares(false);
    }
  };

  const handleProceedToPayment = () => {
    if (selectedVehicle) {
      setStep(AppStep.PAYMENT);
    }
  };

  const handleConfirmPayment = () => {
    setStep(AppStep.SEARCHING_DRIVER);
    
    // Simulate searching delay
    setTimeout(() => {
      handleRideStart();
    }, 3500);
  };

  const handleRideStart = () => {
    if (selectedVehicle && pickup) {
      // 1. Set duration
      const totalSeconds = selectedVehicle.eta * 60;
      setRideEtaSeconds(totalSeconds);

      // 2. Spawn driver randomly near pickup (approx 500m - 1km away)
      const offsetLat = (Math.random() - 0.5) * 0.02; 
      const offsetLng = (Math.random() - 0.5) * 0.02;
      const startDriverPos = {
          lat: pickup.coords.lat + offsetLat,
          lng: pickup.coords.lng + offsetLng
      };
      setDriverLocation(startDriverPos);
      
      // 3. Move to Active State
      setStep(AppStep.RIDE_ACTIVE);
    }
  };

  // Driver Movement & ETA Simulation Effect
  useEffect(() => {
    if (step === AppStep.RIDE_ACTIVE && pickup && driverLocation) {
        // Clear existing interval if any
        if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);

        const target = pickup.coords;
        
        driverIntervalRef.current = setInterval(() => {
            setRideEtaSeconds((prev) => {
                if (prev <= 1) {
                    clearInterval(driverIntervalRef.current);
                    return 0;
                }
                return prev - 1;
            });

            setDriverLocation((prev) => {
                if (!prev) return null;
                const speedFactor = 0.05; 
                return {
                    lat: prev.lat + (target.lat - prev.lat) * speedFactor,
                    lng: prev.lng + (target.lng - prev.lng) * speedFactor
                };
            });
        }, 1000);
    }

    return () => {
        if (driverIntervalRef.current) clearInterval(driverIntervalRef.current);
    };
  }, [step, pickup]); 

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "Arriving now";
    const mins = Math.ceil(seconds / 60);
    return `${mins} min`;
  };

  // --- Renders ---

  const renderLogin = () => (
    <div className="bg-black min-h-screen flex flex-col items-center justify-center p-6 text-white">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
             <h1 className="text-4xl font-bold tracking-tighter mb-2">GoRide</h1>
             <p className="text-gray-400">Welcome back, please login to continue</p>
        </div>
        
        <div className="space-y-4 animate-fade-in">
            <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-4 border border-gray-700 focus-within:border-blue-500 transition-colors">
                 <Mail className="text-gray-400" />
                 <input 
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter Email"
                    className="bg-transparent flex-1 outline-none text-white placeholder-gray-500"
                 />
            </div>
            <div className="bg-gray-800 p-4 rounded-xl flex items-center gap-4 border border-gray-700 focus-within:border-blue-500 transition-colors">
                 <Lock className="text-gray-400" />
                 <input 
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter Password"
                    className="bg-transparent flex-1 outline-none text-white placeholder-gray-500"
                 />
            </div>
            
            <button 
              onClick={handleLogin}
              disabled={!email || !password}
              className="w-full bg-blue-600 text-white p-4 rounded-xl font-bold text-lg hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all mt-6 shadow-lg shadow-blue-900/20"
            >
              Login
            </button>
        </div>
        
        <p className="text-center text-gray-500 text-sm">
            Don't have an account? <span className="text-blue-400 cursor-pointer hover:underline">Sign up</span>
        </p>
      </div>
    </div>
  );

  const renderLocationSelect = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl p-6 z-[1000] min-h-[40vh] transition-all duration-300">
      <div className="w-12 h-1 bg-gray-300 rounded-full mx-auto mb-6"></div>
      
      <div className="relative space-y-4">
        {/* Connection Line */}
        <div className="absolute left-[1.3rem] top-10 bottom-10 w-0.5 bg-gray-200 z-0"></div>

        {/* Pickup */}
        <div className="relative z-10">
          <div className="absolute left-3 top-3.5 w-2 h-2 bg-black rounded-full"></div>
          <input 
            type="text" 
            placeholder="Pickup location"
            value={pickupSearch}
            onFocus={() => setActiveSearchField('pickup')}
            onChange={(e) => setPickupSearch(e.target.value)}
            className="w-full bg-gray-100 p-4 pl-10 rounded-xl font-medium outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Dropoff */}
        <div className="relative z-10">
          <div className="absolute left-3 top-3.5 w-2 h-2 bg-black square"></div>
          <input 
            type="text" 
            placeholder="Where to?"
            value={dropoffSearch}
            onFocus={() => setActiveSearchField('dropoff')}
            onChange={(e) => setDropoffSearch(e.target.value)}
            className="w-full bg-gray-100 p-4 pl-10 rounded-xl font-medium outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      {activeSearchField === 'pickup' && !pickup && (
         <button 
         onClick={handleUseCurrentLocation}
         className="flex items-center gap-3 mt-4 text-blue-600 font-semibold p-2 hover:bg-blue-50 rounded-lg w-full"
       >
         <Navigation size={20} fill="currentColor" />
         Use Current Location
       </button>
      )}

      {/* Find Rides Button */}
      {pickup && dropoff && !activeSearchField && (
          <button 
            onClick={handleFindRides}
            className="w-full mt-6 bg-black text-white p-4 rounded-xl font-bold text-lg hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            Find Rides <ArrowRight size={20} />
          </button>
      )}

      {/* Suggestions List */}
      {suggestions.length > 0 && (
        <div className="mt-4 border-t pt-2 max-h-60 overflow-y-auto">
          {suggestions.map((s, i) => (
            <div 
              key={i} 
              onClick={() => selectAddress(s)}
              className="flex items-center gap-4 p-4 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-0"
            >
              <div className="bg-gray-200 p-2 rounded-full">
                <MapPin size={16} className="text-gray-600" />
              </div>
              <div>
                <p className="font-medium text-gray-800">{s}</p>
                <p className="text-xs text-gray-400 truncate">India</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const getVehicleIcon = (type: RideType) => {
    switch (type) {
        case RideType.BIKE: return <Bike size={24} />;
        case RideType.AUTO: return <Zap size={24} />;
        case RideType.PREMIUM: return <Star size={24} />;
        default: return <Car size={24} />;
    }
  }

  const renderVehicleSelect = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[1000] flex flex-col max-h-[60vh]">
        <div className="p-4 border-b flex items-center">
            <button onClick={() => setStep(AppStep.LOCATION_SELECT)} className="p-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-lg font-bold ml-2">Choose a ride</h2>
        </div>
        
        <div className="overflow-y-auto p-4 space-y-3 pb-24">
            {loadingFares ? (
                <div className="text-center p-8 text-gray-500 animate-pulse">
                    Calculating the best fares for you...
                </div>
            ) : vehicles.map((v) => (
                <div 
                    key={v.id}
                    onClick={() => setSelectedVehicle(v)}
                    className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedVehicle?.id === v.id ? 'border-black bg-gray-50' : 'border-transparent hover:bg-gray-50'}`}
                >
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-12 flex items-center justify-center bg-gray-100 rounded-lg text-gray-700">
                           {getVehicleIcon(v.type)}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-lg">{v.name}</h3>
                                <div className="flex items-center text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    <UserIcon size={10} className="mr-1" /> 4
                                </div>
                            </div>
                            <p className="text-sm text-gray-500">{v.eta} mins away • {v.description}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="font-bold text-lg">{v.currency}{v.price}</p>
                        {v.type === RideType.BIKE && <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">Promo</span>}
                    </div>
                </div>
            ))}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t safe-area-bottom">
            <button 
                disabled={!selectedVehicle}
                onClick={handleProceedToPayment}
                className="w-full bg-black text-white py-4 rounded-xl font-bold text-xl hover:bg-gray-800 disabled:opacity-50 transition-colors shadow-lg"
            >
                Proceed to Payment
            </button>
        </div>
    </div>
  );

  const renderPayment = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[1000] p-6 animate-slide-up">
       <div className="flex items-center mb-6">
            <button onClick={() => setStep(AppStep.VEHICLE_SELECT)} className="p-2 -ml-2 hover:bg-gray-100 rounded-full">
                <ChevronLeft size={24} />
            </button>
            <h2 className="text-xl font-bold ml-2">Payment</h2>
        </div>

        <div className="bg-gray-50 p-4 rounded-xl mb-6 flex justify-between items-center border border-gray-100">
             <div>
                 <p className="text-gray-500 text-sm">Amount to Pay</p>
                 <p className="text-2xl font-bold">{selectedVehicle?.currency}{selectedVehicle?.price}</p>
             </div>
             <div className="bg-white p-2 rounded-lg shadow-sm">
                {selectedVehicle && getVehicleIcon(selectedVehicle.type)}
             </div>
        </div>

        <h3 className="font-bold text-gray-700 mb-4">Payment Method</h3>
        <div className="space-y-3 mb-8">
            <div 
                onClick={() => setPaymentMethod('UPI')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${paymentMethod === 'UPI' ? 'border-black bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-blue-600">
                    <Smartphone size={20} />
                </div>
                <div className="flex-1">
                    <p className="font-bold">UPI</p>
                    <p className="text-xs text-gray-500">Google Pay, PhonePe, Paytm</p>
                </div>
                {paymentMethod === 'UPI' && <div className="w-4 h-4 bg-black rounded-full" />}
            </div>

            <div 
                onClick={() => setPaymentMethod('CARD')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${paymentMethod === 'CARD' ? 'border-black bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-purple-600">
                    <CreditCard size={20} />
                </div>
                <div className="flex-1">
                    <p className="font-bold">Card</p>
                    <p className="text-xs text-gray-500">Credit or Debit Card</p>
                </div>
                {paymentMethod === 'CARD' && <div className="w-4 h-4 bg-black rounded-full" />}
            </div>

            <div 
                onClick={() => setPaymentMethod('CASH')}
                className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer ${paymentMethod === 'CASH' ? 'border-black bg-blue-50/50' : 'border-gray-100 hover:bg-gray-50'}`}
            >
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm text-green-600">
                    <Banknote size={20} />
                </div>
                <div className="flex-1">
                    <p className="font-bold">Cash</p>
                    <p className="text-xs text-gray-500">Pay at end of ride</p>
                </div>
                {paymentMethod === 'CASH' && <div className="w-4 h-4 bg-black rounded-full" />}
            </div>
        </div>

        <button 
          onClick={handleConfirmPayment}
          className="w-full bg-black text-white py-4 rounded-xl font-bold text-xl hover:bg-gray-800 transition-colors shadow-lg"
        >
          Confirm Booking
        </button>
    </div>
  );

  const renderSearching = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[1000] p-8 flex flex-col items-center justify-center min-h-[40vh] animate-slide-up">
        <div className="mb-6 relative">
            <div className="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center relative z-10">
                <Loader2 size={40} className="text-blue-600 animate-spin" />
            </div>
        </div>
        <h2 className="text-2xl font-bold mb-2">Payment Successful</h2>
        <p className="text-gray-500 mb-6">Searching for nearby drivers...</p>
        
        <div className="w-full bg-gray-100 h-1.5 rounded-full overflow-hidden">
            <div className="h-full bg-blue-600 animate-progress-indeterminate"></div>
        </div>
    </div>
  );

  const renderRideActive = () => (
    <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl z-[1000] p-6 animate-slide-up">
        <div className="flex items-center justify-between mb-6">
            <div>
                <h2 className="text-2xl font-bold mb-1">Ride Confirmed</h2>
                <p className="text-green-600 font-medium">Driver arriving soon</p>
            </div>
            <div className="bg-green-100 p-3 rounded-full text-green-700">
                <ShieldCheck size={32} />
            </div>
        </div>

        <div className="flex items-center gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
             <div className="w-14 h-14 bg-gray-200 rounded-full overflow-hidden flex items-center justify-center">
                <UserIcon size={32} className="text-gray-400" />
             </div>
             <div className="flex-1">
                <h3 className="font-bold text-lg">Michael D.</h3>
                <div className="flex items-center text-sm text-gray-500">
                    <Star size={14} className="text-yellow-500 fill-current mr-1" />
                    4.9 • KA 05 MC 4021
                </div>
                <p className="text-xs text-gray-400 mt-1">White Toyota Camry</p>
             </div>
             <div className="text-right">
                 <p className="text-xs text-gray-400 font-bold mb-1">ETA</p>
                 <p className="font-bold text-xl text-blue-600">{formatTime(rideEtaSeconds)}</p>
             </div>
        </div>

        <div className="space-y-4">
            <div className="flex items-start gap-4">
                <div className="mt-1">
                     <Clock size={20} className="text-blue-600" />
                </div>
                <div className="flex-1 border-b pb-4">
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Pickup</p>
                    <p className="font-medium">{pickup?.name}</p>
                </div>
            </div>
            <div className="flex items-start gap-4">
                <div className="mt-1">
                     <MapPin size={20} className="text-red-600" />
                </div>
                <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Dropoff</p>
                    <p className="font-medium">{dropoff?.name}</p>
                </div>
            </div>
        </div>

        <button 
          onClick={() => {
              setStep(AppStep.LOCATION_SELECT);
              setPickup(null);
              setDropoff(null);
              setPickupSearch("");
              setDropoffSearch("");
              setSelectedVehicle(null);
              setDriverLocation(null);
          }}
          className="w-full mt-8 bg-red-50 text-red-600 py-4 rounded-xl font-bold hover:bg-red-100 transition-colors"
        >
            Cancel Ride
        </button>
    </div>
  );

  // Main Render Logic
  if (step === AppStep.LOGIN) {
    return renderLogin();
  }

  return (
    <div className="h-screen w-full relative overflow-hidden font-sans text-gray-900">
      {/* Map Background */}
      <MapComponent 
        pickup={pickup?.coords || null} 
        dropoff={dropoff?.coords || null} 
        userLocation={userCoords}
        driverLocation={driverLocation} 
        onMapClick={handleMapClick}
      />
      
      {/* UI Overlays */}
      <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start z-[500] pointer-events-none">
          <div className="bg-white/90 backdrop-blur-sm p-2 rounded-full shadow-lg pointer-events-auto cursor-pointer">
             <div className="w-8 h-8 flex items-center justify-center font-bold">
                 <span className="text-xl">☰</span>
             </div>
          </div>
           {/* Profile Pill */}
           <div className="bg-white/90 backdrop-blur-sm px-4 py-2 rounded-full shadow-lg pointer-events-auto flex items-center gap-2">
               <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                 <UserIcon size={14} />
               </div>
               <p className="font-bold text-sm">{userName || 'User'}</p>
           </div>
      </div>

      {step === AppStep.LOCATION_SELECT && renderLocationSelect()}
      {step === AppStep.VEHICLE_SELECT && renderVehicleSelect()}
      {step === AppStep.PAYMENT && renderPayment()}
      {step === AppStep.SEARCHING_DRIVER && renderSearching()}
      {step === AppStep.RIDE_ACTIVE && renderRideActive()}
    </div>
  );
};

export default App;
