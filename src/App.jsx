import { MapContainer, TileLayer, GeoJSON, Marker, Tooltip, Popup } from 'react-leaflet';
import L from 'leaflet';
import { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import osmtogeojson from 'osmtogeojson';
import { createLimitedQueue } from './util/throttleQueue.js';

// Helper to strip "asema" suffix from station names
const fixName = (name) => (name || '').replace(/ ?asema$/i, '');

// Fetch mapping of station short codes to full names
function useStations() {
  const [lookup, setLookup] = useState({});
  useEffect(() => {
    axios
      .get('https://rata.digitraffic.fi/api/v1/metadata/stations')
      .then((res) => {
        const map = {};
        res.data.forEach((s) => {
          map[s.stationShortCode] = s.stationName;
        });
        setLookup(map);
      })
      .catch(console.error);
  }, []);
  return lookup;
}

const FINLAND_BOUNDS = [
  [59.3, 19.0],
  [70.2, 31.6],
];

const RAIL_QUERY = `[out:json][timeout:60];
(
  way["railway"~"^(rail|tram|light_rail|subway|disused|abandoned)$"](60.0,19.0,70.5,32.0);
);
out geom;`;

const overpassUrl = 'https://overpass-api.de/api/interpreter';
const digitrafficBase = 'https://rata.digitraffic.fi/api/v1';

function useRails() {
  const [data, setData] = useState(null);
  useEffect(() => {
    axios
      .post(overpassUrl, RAIL_QUERY, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      })
      .then((res) => {
        const geojson = osmtogeojson(res.data);
        setData(geojson);
      })
      .catch(console.error);
  }, []);
  return data;
}

function useTrains() {
  const [trains, setTrains] = useState([]);
  // train cache of metadata
  const metaRef = useRef({});
  const enqueue = useMemo(() => createLimitedQueue(50), []);
  useEffect(() => {
    const fetchPositions = () => {
      axios
        .get(`${digitrafficBase}/train-locations/latest`)
        .then(async (res) => {
          const locs = res.data || [];
          const today = new Date().toISOString().slice(0, 10);
          const updated = await Promise.all(
            locs.map(async (t) => {
              const key = `${t.trainNumber}-${today}`;
              // load from localStorage if present
              if (!metaRef.current[t.trainNumber] && localStorage.getItem(key)) {
                metaRef.current[t.trainNumber] = JSON.parse(localStorage.getItem(key));
              }
              if (!metaRef.current[t.trainNumber]) {
                enqueue(async () => {
                  try {
                    const metaRes = await axios.get(
                      `${digitrafficBase}/trains/${today}/${t.trainNumber}`
                    );
                    const timetable = metaRes.data?.[0];
                    let origin, dest;
                    if (timetable?.timeTableRows) {
                      origin = timetable.timeTableRows.find((r) => r.type === 'DEPARTURE')?.stationShortCode;
                      dest = [...timetable.timeTableRows]
                        .reverse()
                        .find((r) => r.type === 'ARRIVAL')?.stationShortCode;
                    }
                    const meta = { origin, dest };
                    metaRef.current[t.trainNumber] = meta;
                    localStorage.setItem(key, JSON.stringify(meta));
                  } catch (e) {
                    if (e.response?.status === 429) {
                      console.warn('Digitraffic rate limit hit');
                    } else {
                      console.error(e);
                    }
                  }
                });
              }
              return { ...t, ...(metaRef.current[t.trainNumber] || {}) };
            })
          );
          setTrains(updated);
        })
        .catch(console.error);
    };
    fetchPositions();
    const id = setInterval(fetchPositions, 10000);
    return () => clearInterval(id);
  }, []);
  return trains;
}

function App() {
  const [openTrains, setOpenTrains] = useState([]);
  const stations = useStations();
  
  const rails = useRails();


  const trains = useTrains();

  const railStyle = {
    color: '#ff6600',
    weight: 2,
  };

  const trainIcon = useMemo(() => {
    return L.divIcon({
      className: 'train-marker',
      html: '🚆',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }, []);

  const [segmentInfo, setSegmentInfo] = useState(null);

  const onRailClick = (e) => {
    // placeholder: we don't have history yet
    setSegmentInfo({
      latlng: e.latlng,
      previous: 'unknown',
      next: 'unknown',
    });
  };

  const addOverlay = (num) => {
    setOpenTrains((prev) => (prev.includes(num) ? prev : [...prev, num]));
  };
  const removeOverlay = (num) => setOpenTrains((p) => p.filter((n) => n !== num));

  return (
    <>
      <MapContainer
      bounds={FINLAND_BOUNDS}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {rails && (
        <GeoJSON data={rails} style={railStyle} eventHandlers={{ click: onRailClick }} />
      )}
      {trains.map((t) => (
        <Marker
          key={t.trainNumber}
          position={[t.location.coordinates[1], t.location.coordinates[0]]}
          icon={trainIcon}
          eventHandlers={{ click: () => addOverlay(t.trainNumber) }}
        >
          {!openTrains.includes(t.trainNumber) && (
            <Tooltip>{`${fixName(stations[t.origin] || t.origin)} → ${fixName(stations[t.dest] || t.dest)}  ${t.speed ? t.speed.toFixed(0)+' km/h' : ''}`}</Tooltip>
          )}
        </Marker>
      ))}
      {segmentInfo && (
        <Popup
          position={segmentInfo.latlng}
          eventHandlers={{ close: () => setSegmentInfo(null) }}
        >
          <div style={{ maxWidth: 200 }}>
            <strong>Previous train:</strong> {segmentInfo.previous}
            <br />
            <strong>Next train:</strong> {segmentInfo.next}
          </div>
        </Popup>
      )}
      {openTrains.map((num, idx) => (
         <TrainOverlay key={num} index={idx} trainNumber={num} trains={trains} stations={stations} onClose={removeOverlay} />
       ))}
     </MapContainer>
      
    </>
  );
}

function TrainOverlay({ trainNumber, index, trains, stations, onClose }) {
  const train = trains.find((t) => t.trainNumber === trainNumber);
  if (!train) return null;
  const { origin, dest, speed, location } = train;
  return (
    <Popup
      position={[location.coordinates[1], location.coordinates[0]]}
      offset={[index * 20, index * 40]}
      autoClose={false}
      closeOnClick={false}
      closeButton={true}
      eventHandlers={{ remove: () => onClose(trainNumber), close: () => onClose(trainNumber) }}
    >
      <div style={{ minWidth: 180 }}>
      <strong>Train {trainNumber}</strong>
      <br />
      {fixName(stations[origin] || origin)} → {fixName(stations[dest] || dest)}
      <br />
      {speed != null && (
        <>Speed: {speed.toFixed(1)} km/h</>
      )}
      </div>
    </Popup>
  );
}

export default App;
