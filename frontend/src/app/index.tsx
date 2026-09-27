import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TextInput, FlatList, 
  Image, TouchableOpacity, Linking, ActivityIndicator,
  ScrollView, SafeAreaView, StatusBar, Alert, Platform, useWindowDimensions, Modal, Clipboard
} from 'react-native';
import { supabase } from '../supabase';

const TMDB_TOKEN = 'eyJhbGciOiJIUzI1NiJ9.eyJhdWQiOiI3ZGQxZGFjMGZkMjZjNmYyMDI3NDE4Zjc3NmVhODc3MyIsIm5iZiI6MTc4NTEzMzg2NS41NTAwMDAyLCJzdWIiOiI2YTY2ZmIyOTA3YjZkM2FjOGVjYjJiZTQiLCJzY29wZXMiOlsiYXBpX3JlYWQiXSwidmVyc2lvbiI6MX0.rTgxkuj9b2PK5eXIsMe_mmVbmsTBG0ONb31lFwpCE7w';

const glassBackground = Platform.OS === 'web' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(30, 30, 30, 0.8)';
const glassBorder = 'rgba(255, 255, 255, 0.1)';

const LANGUAGES = [
  { code: 'All', name: 'All Languages' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'Hindi' },
  { code: 'te', name: 'Telugu' },
  { code: 'ta', name: 'Tamil' },
  { code: 'ml', name: 'Malayalam' },
  { code: 'kn', name: 'Kannada' },
  { code: 'ko', name: 'Korean' },
  { code: 'ja', name: 'Japanese' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' }
];

const PLATFORMS = ['All', 'Netflix', 'Amazon', 'Disney', 'JioCinema', 'Hotstar', 'Apple', 'Zee5', 'SonyLIV', 'Hulu', 'Max'];

export default function App() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const getNumColumns = () => {
    if (width >= 1600) return 6; 
    if (width >= 1200) return 5; 
    if (width >= 900) return 4;  
    if (width >= 600) return 3;  
    if (width >= 300) return 2;  
    return 1;                    
  };
  const numColumns = getNumColumns();

  const [session, setSession] = useState<any>(null);
  const [authStep, setAuthStep] = useState(1);
  const [loginName, setLoginName] = useState('');
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [loadingAuth, setLoadingAuth] = useState(false);

  // Shared Watchlist State
  const [sharedUserId, setSharedUserId] = useState<string | null>(null);
  const isReadOnly = !!sharedUserId && !session;

  const [activeTab, setActiveTab] = useState('discover'); 
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [providersLoading, setProvidersLoading] = useState<number | null>(null);

  const [selectedDetails, setSelectedDetails] = useState<any>(null);
  const [detailsProvidersLoading, setDetailsProvidersLoading] = useState(false);
  
  const [selectedActor, setSelectedActor] = useState<any>(null);

  const [discoverResults, setDiscoverResults] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoverType, setDiscoverType] = useState('movie'); 
  const [discoverGenre, setDiscoverGenre] = useState('');
  const [discoverLang, setDiscoverLang] = useState('');

  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('All'); 
  const [filterLang, setFilterLang] = useState('All');
  const [filterOtt, setFilterOtt] = useState('All');
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  
  const [isListening, setIsListening] = useState(false);
  const [speechLanguage, setSpeechLanguage] = useState('en-US'); 
  const [showLangDropdown, setShowLangDropdown] = useState(false);

  const [showAlerts, setShowAlerts] = useState(false);
  const [notifications, setNotifications] = useState<string[]>([]);

  // --- INIT & AUTHENTICATION ---
  useEffect(() => {
    if (Platform.OS === 'web') {
       const params = new URLSearchParams(window.location.search);
       const uid = params.get('user');
       if (uid) {
          setSharedUserId(uid);
          fetchSharedWatchlist(uid);
       }
    }

    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    supabase.auth.onAuthStateChange((_event, session) => {
       setSession(session);
       if (session) setSharedUserId(null); // Once logged in, switch to personal mode
    });
  }, []);

  const fetchSharedWatchlist = async (uid: string) => {
    const { data } = await supabase.from('watchlist').select('movie_data').eq('user_id', uid);
    if (data) {
      const savedItems = data.map(row => row.movie_data);
      setWatchlist(savedItems);
      setActiveTab('watchlist');
      savedItems.forEach(async (item) => {
         if (!item.providers) {
            try {
               const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/watch/providers`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
               const pData = await res.json();
               const uniqueProviders = extractProviders(pData);
               setWatchlist(prev => prev.map(r => r.id === item.id ? { ...r, providers: uniqueProviders, showProviders: true } : r));
            } catch (e) {}
         }
      });
    }
  };

  const handleGenerateOtp = () => {
    if (loginName.trim().length < 2) return Alert.alert('Enter a valid name');
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    setGeneratedOtp(otp);
    setAuthStep(2);
  };

  const handleLoginWithOtp = async () => {
    if (otpInput !== generatedOtp) return Alert.alert('Invalid OTP');
    setLoadingAuth(true);
    const cleanName = loginName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dummyEmail = `${cleanName}@universalstream.local`;
    const dummyPassword = 'UniversalPassword123!';
    const { error: signInError } = await supabase.auth.signInWithPassword({ email: dummyEmail, password: dummyPassword });
    if (signInError) {
      const { error: signUpError } = await supabase.auth.signUp({ email: dummyEmail, password: dummyPassword });
      if (signUpError) Alert.alert('Error', signUpError.message);
    }
    setLoadingAuth(false);
  };

  const startVoiceSearch = () => {
    if (Platform.OS !== 'web') return Alert.alert("Voice search is optimized for Web.");
    // @ts-ignore
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return Alert.alert("Your browser does not support voice search.");
    const recognition = new SpeechRecognition();
    recognition.lang = speechLanguage;
    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (e: any) => setQuery(e.results[0][0].transcript);
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognition.start();
  };

  useEffect(() => { if (session && !sharedUserId) fetchWatchlist(); }, [session]);

  const fetchWatchlist = async () => {
    const { data } = await supabase.from('watchlist').select('movie_data').eq('user_id', session.user.id);
    if (data) {
      const savedItems = data.map(row => row.movie_data);
      setWatchlist(savedItems);
      generateAlerts(savedItems);
      
      savedItems.forEach(async (item) => {
         if (!item.providers) {
            try {
               const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/watch/providers`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
               const pData = await res.json();
               const uniqueProviders = extractProviders(pData);
               const updatedItem = { ...item, providers: uniqueProviders, showProviders: true };
               setWatchlist(prev => prev.map(r => r.id === item.id ? updatedItem : r));
               await supabase.from('watchlist').update({ movie_data: updatedItem }).eq('user_id', session.user.id).eq('movie_id', item.id);
            } catch (e) {}
         }
      });
    }
  };

  const generateAlerts = (items: any[]) => {
    const now = new Date();
    const alerts: string[] = [];
    items.forEach(item => {
      const title = item.title || item.name;
      const releaseStr = item.release_date || item.first_air_date;
      if (releaseStr) {
        const diffDays = (now.getTime() - new Date(releaseStr).getTime()) / (1000 * 3600 * 24);
        if (diffDays >= 0 && diffDays <= 14) alerts.push(`🔥 "${title}" just released!`);
        else if (diffDays < 0 && diffDays >= -14) alerts.push(`⏰ "${title}" releases in ${Math.ceil(Math.abs(diffDays))} days!`);
      }
    });
    setNotifications(alerts);
  };

  const toggleWatchlist = async (movie: any) => {
    if (isReadOnly) return Alert.alert("You are viewing a shared watchlist.");
    const exists = watchlist.find(item => item.id === movie.id);
    if (exists) {
      const newWatchlist = watchlist.filter(item => item.id !== movie.id);
      setWatchlist(newWatchlist);
      generateAlerts(newWatchlist);
      await supabase.from('watchlist').delete().eq('user_id', session.user.id).eq('movie_id', movie.id);
    } else {
      const newWatchlist = [movie, ...watchlist];
      setWatchlist(newWatchlist);
      generateAlerts(newWatchlist);
      await supabase.from('watchlist').insert({ user_id: session.user.id, movie_id: movie.id, movie_data: movie });
    }
    
    if (selectedDetails?.id === movie.id) {
       setSelectedDetails({ ...selectedDetails, inWatchlist: !exists });
    }
  };

  const copyShareLink = () => {
    if (Platform.OS === 'web' && session) {
       const url = `${window.location.origin}/?user=${session.user.id}`;
       navigator.clipboard.writeText(url);
       Alert.alert("Link Copied!", "Share this URL with your friends so they can view your watchlist!");
    }
  };

  // --- DISCOVER / SEARCH LOGIC ---
  useEffect(() => {
    if (query.trim().length === 0 && !isReadOnly) fetchDiscover();
  }, [query, discoverType, discoverGenre, discoverLang]);

  const fetchDiscover = async () => {
    setIsDiscovering(true);
    let url = `https://api.themoviedb.org/3/discover/${discoverType}?include_adult=false&sort_by=popularity.desc`;
    if (discoverGenre) url += `&with_genres=${discoverGenre}`;
    if (discoverLang) url += `&with_original_language=${discoverLang}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const data = await res.json();
    setDiscoverResults((data.results || []).map((item: any) => ({ ...item, media_type: discoverType })));
    setIsDiscovering(false);
  };

  useEffect(() => {
    const delay = setTimeout(() => {
      if (query.trim().length > 2 && !isReadOnly) fetchSearch(query);
      else setSearchResults([]);
    }, 500); 
    return () => clearTimeout(delay);
  }, [query]);

  const fetchSearch = async (searchQuery: string) => {
    setIsSearching(true);
    const langPrefix = speechLanguage.split('-')[0];
    const res = await fetch(`https://api.themoviedb.org/3/search/multi?query=${encodeURIComponent(searchQuery)}&include_adult=false&language=${langPrefix}`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const data = await res.json();
    setSearchResults((data.results || []).filter((i: any) => i.media_type === 'movie' || i.media_type === 'tv').slice(0, 16));
    setIsSearching(false);
  };

  const extractProviders = (data: any) => {
     const inData = data.results?.IN || {};
     const usData = data.results?.US || {};
     const extract = (d: any) => [...(d.flatrate || []), ...(d.free || []), ...(d.ads || []), ...(d.rent || []), ...(d.buy || [])];
     const combined = [...extract(inData), ...extract(usData)];
     return combined.filter((v,i,a) => a.findIndex(v2 => v2.provider_id === v.provider_id) === i);
  };

  const fetchProviders = async (item: any) => {
    setProvidersLoading(item.id);
    const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/watch/providers`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const data = await res.json();
    const uniqueProviders = extractProviders(data);
    
    const updateFn = (prev: any[]) => prev.map(r => r.id === item.id ? { ...r, providers: uniqueProviders, showProviders: true } : r);
    setDiscoverResults(updateFn);
    setSearchResults(updateFn);
    setWatchlist(updateFn);
    setProvidersLoading(null);
  };

  const fetchDetailsProviders = async (item: any) => {
    setDetailsProvidersLoading(true);
    const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/watch/providers`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
    const data = await res.json();
    const uniqueProviders = extractProviders(data);
    setSelectedDetails((prev: any) => ({ ...prev, providers: uniqueProviders, showProviders: true }));
    setDetailsProvidersLoading(false);
  };

  const openProvider = (name: string, title: string) => {
    const q = encodeURIComponent(title);
    const nl = name.toLowerCase();
    let url = `https://www.google.com/search?q=${q}+on+${encodeURIComponent(name)}`;
    if (nl.includes('netflix')) url = `https://www.netflix.com/search?q=${q}`;
    else if (nl.includes('amazon') || nl.includes('prime')) url = `https://www.amazon.com/s?k=${q}&i=instant-video`;
    else if (nl.includes('hotstar')) url = `https://www.hotstar.com/in/explore?search_query=${q}`;
    else if (nl.includes('jiocinema')) url = `https://www.jiocinema.com/search?q=${q}`;
    Linking.openURL(url);
  };

  const openDetails = async (item: any) => {
     setSelectedDetails(item); 
     try {
       const res = await fetch(`https://api.themoviedb.org/3/${item.media_type}/${item.id}/credits`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
       const data = await res.json();
       const topCast = (data.cast || []).slice(0, 10);
       setSelectedDetails((prev: any) => ({ ...prev, credits: topCast }));
     } catch (error) { console.error(error); }
  };

  const fetchActorFilmography = async (actor: any) => {
     try {
       const res = await fetch(`https://api.themoviedb.org/3/person/${actor.id}?append_to_response=combined_credits`, { headers: { Authorization: `Bearer ${TMDB_TOKEN}` } });
       const data = await res.json();
       // Sort credits by popularity
       if (data.combined_credits?.cast) {
          data.combined_credits.cast = data.combined_credits.cast.sort((a: any, b: any) => b.popularity - a.popularity);
       }
       setSelectedActor(data);
     } catch (error) { console.error(error); }
  };

  const isInWatchlist = (id: number) => watchlist.some(item => item.id === id);
  const getReleaseStatus = (dateStr: string) => {
     if (!dateStr) return { status: '', isFuture: false };
     const isFuture = new Date(dateStr) > new Date();
     return { status: isFuture ? `Releasing: ${dateStr}` : dateStr.split('-')[0], isFuture };
  };

  const renderHeroBanner = (item: any) => {
     const fallbackBg = `https://via.placeholder.com/1920x1080/1e293b/ffffff?text=No+Backdrop+Available`;
     const bgUrl = item.backdrop_path || item.poster_path ? `https://image.tmdb.org/t/p/original${item.backdrop_path || item.poster_path}` : fallbackBg;
     const releaseDateStr = item.release_date || item.first_air_date || 'TBD';
     const { status } = getReleaseStatus(releaseDateStr);
     const saved = isInWatchlist(item.id);
     
     return (
        <TouchableOpacity activeOpacity={0.9} style={styles.heroBanner} onPress={() => openDetails(item)}>
           <Image source={{uri: bgUrl}} style={StyleSheet.absoluteFillObject} />
           <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>{item.title || item.name}</Text>
              <Text style={styles.heroMeta}>{item.media_type?.toUpperCase()} • {status} • ⭐ {item.vote_average?.toFixed(1)}</Text>
              <Text numberOfLines={3} style={styles.heroOverview}>{item.overview}</Text>
              <View style={{flexDirection: 'row', gap: 12, marginTop: 16}}>
                 <View style={styles.heroBtnPrimary}><Text style={styles.heroBtnTextPrimary}>More Details</Text></View>
                 {!isReadOnly && (
                    <TouchableOpacity style={styles.heroBtnSecondary} onPress={(e) => { e.stopPropagation(); toggleWatchlist(item); }}>
                       <Text style={styles.heroBtnTextSecondary}>{saved ? '★ Saved to List' : '☆ Save to List'}</Text>
                    </TouchableOpacity>
                 )}
              </View>
           </View>
        </TouchableOpacity>
     );
  };

  const renderCinematicCard = ({item}: {item: any}) => {
    const fallbackPoster = `https://via.placeholder.com/500x750/1e293b/ffffff?text=No+Poster`;
    const posterUrl = item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : fallbackPoster;
    const releaseDateStr = item.release_date || item.first_air_date || 'TBD';
    const { status, isFuture } = getReleaseStatus(releaseDateStr);
    const saved = isInWatchlist(item.id);

    return (
      <TouchableOpacity 
         activeOpacity={0.8} 
         style={[styles.cinemaCard, { maxWidth: `${100 / numColumns}%` }]} 
         onPress={() => openDetails(item)}
      >
        <Image source={{ uri: posterUrl }} style={StyleSheet.absoluteFillObject} />
        
        <View style={styles.cardGradient} />
        
        {!isReadOnly && (
           <TouchableOpacity style={styles.floatingSaveBtn} onPress={(e) => { e.stopPropagation(); toggleWatchlist(item); }}>
              <Text style={saved ? styles.savedIconLg : styles.saveIconLg}>{saved ? '★' : '☆'}</Text>
           </TouchableOpacity>
        )}

        <View style={styles.cardContent}>
           <Text style={styles.cardTitle} numberOfLines={2}>{item.title || item.name}</Text>
           <Text style={styles.cardMeta}>{status} • ⭐ {item.vote_average?.toFixed(1)}</Text>
           
           <View style={{marginTop: 12}}>
              {!item.showProviders ? (
                 <TouchableOpacity style={styles.glassBtnSmall} onPress={(e) => { e.stopPropagation(); fetchProviders(item); }}>
                    {providersLoading === item.id ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.glassBtnText}>Where to Watch?</Text>}
                 </TouchableOpacity>
              ) : (
                 <View style={styles.providersGridContainer}>
                    {item.providers?.length > 0 ? (
                       <ScrollView horizontal showsHorizontalScrollIndicator={false} onStartShouldSetResponder={() => true}>
                          {item.providers.map((p: any) => (
                             <TouchableOpacity key={p.provider_id} onPress={(e) => { e.stopPropagation(); openProvider(p.provider_name, item.title || item.name); }}>
                                <Image source={{ uri: `https://image.tmdb.org/t/p/w200${p.logo_path}` }} style={styles.providerLogoSmall} />
                             </TouchableOpacity>
                          ))}
                       </ScrollView>
                    ) : (
                       <Text style={styles.futureText}>{isFuture ? `Theatrical Release: ${releaseDateStr}` : `Not streaming. (Released: ${releaseDateStr})`}</Text>
                    )}
                 </View>
              )}
           </View>
        </View>
      </TouchableOpacity>
    );
  };


  if (!session && !sharedUserId) {
    return (
      <View style={styles.authContainer}>
        <Text style={styles.authTitle}>CINEFILE</Text>
        <Text style={styles.authSub}>Your Cinematic Journey Starts Here</Text>
        <View style={styles.glassPanel}>
          {authStep === 1 && (
             <>
                <TextInput onChangeText={setLoginName} value={loginName} placeholder="Enter your name" placeholderTextColor="rgba(255,255,255,0.5)" style={styles.glassInput} />
                <TouchableOpacity style={styles.primaryBtn} onPress={handleGenerateOtp}>
                  <Text style={styles.primaryBtnText}>Continue</Text>
                </TouchableOpacity>
             </>
          )}
          {authStep === 2 && (
             <>
                <Text style={{color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginBottom: 16}}>Test OTP: <Text style={{color: '#fff', fontWeight: 'bold'}}>{generatedOtp}</Text></Text>
                <TextInput onChangeText={setOtpInput} value={otpInput} placeholder="Enter OTP" placeholderTextColor="rgba(255,255,255,0.5)" keyboardType="number-pad" style={styles.glassInput} />
                <TouchableOpacity style={styles.primaryBtn} disabled={loadingAuth} onPress={handleLoginWithOtp}>
                  <Text style={styles.primaryBtnText}>{loadingAuth ? 'Authenticating...' : 'Enter'}</Text>
                </TouchableOpacity>
             </>
          )}
        </View>
      </View>
    );
  }

  const isQueryEmpty = query.trim().length <= 2;
  const rawListData = activeTab === 'watchlist' 
     ? watchlist.filter(item => {
          const matchType = filterType === 'All' || item.media_type === filterType.toLowerCase();
          const matchLang = filterLang === 'All' || item.original_language === filterLang;
          const matchOtt = filterOtt === 'All' || (item.providers && item.providers.some((p:any) => p.provider_name?.includes(filterOtt.split(' ')[0])));
          return matchType && matchLang && matchOtt;
       }) 
     : (isQueryEmpty ? discoverResults : searchResults);

  const isHeroActive = isDesktop && isQueryEmpty && activeTab === 'discover' && rawListData.length > 0 && !isReadOnly;
  const gridData = isHeroActive ? rawListData.slice(1) : rawListData;

  const userName = session?.user?.email?.split('@')[0] || "User";
  const formattedName = userName.charAt(0).toUpperCase() + userName.slice(1);

  const renderSidebar = () => (
    <View style={styles.sidebar}>
       <Text style={styles.sidebarLogo}>CINEFILE</Text>
       <View style={{marginTop: 40, gap: 16}}>
          {!isReadOnly && (
             <TouchableOpacity style={[styles.navItem, activeTab === 'discover' && styles.navItemActive]} onPress={() => setActiveTab('discover')}>
                <Text style={[styles.navText, activeTab === 'discover' && styles.navTextActive]}>Discover</Text>
             </TouchableOpacity>
          )}
          <TouchableOpacity style={[styles.navItem, activeTab === 'watchlist' && styles.navItemActive]} onPress={() => setActiveTab('watchlist')}>
             <Text style={[styles.navText, activeTab === 'watchlist' && styles.navTextActive]}>
               {isReadOnly ? "Shared Watchlist" : `Watchlist (${watchlist.length})`}
             </Text>
          </TouchableOpacity>
          {!isReadOnly && (
             <TouchableOpacity style={[styles.navItem, activeTab === 'profile' && styles.navItemActive]} onPress={() => setActiveTab('profile')}>
                <Text style={[styles.navText, activeTab === 'profile' && styles.navTextActive]}>Profile</Text>
             </TouchableOpacity>
          )}
       </View>
       
       <View style={{marginTop: 'auto', gap: 16}}>
          {!isReadOnly && (
             <TouchableOpacity style={styles.navItem} onPress={() => setShowAlerts(!showAlerts)}>
                <Text style={styles.navText}>Alerts {notifications.length > 0 && '🔴'}</Text>
             </TouchableOpacity>
          )}
          {isReadOnly && (
             <TouchableOpacity style={styles.navItem} onPress={() => window.location.href = '/'}>
                <Text style={styles.navTextActive}>Create your own</Text>
             </TouchableOpacity>
          )}
       </View>
    </View>
  );

  const renderBottomNav = () => (
    <View style={styles.bottomNav}>
       {!isReadOnly && (
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setActiveTab('discover')}>
             <Text style={[styles.bottomNavText, activeTab === 'discover' && styles.bottomNavTextActive]}>Discover</Text>
          </TouchableOpacity>
       )}
       <TouchableOpacity style={styles.bottomNavItem} onPress={() => setActiveTab('watchlist')}>
          <Text style={[styles.bottomNavText, activeTab === 'watchlist' && styles.bottomNavTextActive]}>{isReadOnly ? 'Shared' : 'Watchlist'}</Text>
       </TouchableOpacity>
       {!isReadOnly ? (
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => setActiveTab('profile')}>
             <Text style={[styles.bottomNavText, activeTab === 'profile' && styles.bottomNavTextActive]}>Profile</Text>
          </TouchableOpacity>
       ) : (
          <TouchableOpacity style={styles.bottomNavItem} onPress={() => window.location.href = '/'}>
             <Text style={[styles.bottomNavText, {color: '#38bdf8'}]}>Create Account</Text>
          </TouchableOpacity>
       )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* ACTOR FILMOGRAPHY MODAL */}
      <Modal visible={!!selectedActor} animationType="fade" transparent={true}>
         {selectedActor && (
            <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedActor(null)}>
                     <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold'}}>✕</Text>
                  </TouchableOpacity>
                  <ScrollView showsVerticalScrollIndicator={false}>
                     <View style={{padding: 32, flexDirection: isDesktop ? 'row' : 'column', gap: 32}}>
                        <Image source={{uri: `https://image.tmdb.org/t/p/w500${selectedActor.profile_path}`}} style={{width: 200, height: 300, borderRadius: 16, backgroundColor: glassBackground}} />
                        <View style={{flex: 1}}>
                           <Text style={{fontSize: 40, color: '#fff', fontWeight: '900', marginBottom: 8}}>{selectedActor.name}</Text>
                           <Text style={{fontSize: 16, color: '#38bdf8', marginBottom: 16}}>{selectedActor.known_for_department} • Born {selectedActor.birthday}</Text>
                           <Text style={{color: 'rgba(255,255,255,0.8)', lineHeight: 22, marginBottom: 24}}>{selectedActor.biography}</Text>
                        </View>
                     </View>

                     <View style={{paddingHorizontal: 32, paddingBottom: 32}}>
                        <Text style={{fontSize: 24, color: '#fff', fontWeight: '800', marginBottom: 16}}>Filmography</Text>
                        <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 16}}>
                           {(selectedActor.combined_credits?.cast || []).slice(0, 20).map((movie: any) => (
                              <TouchableOpacity key={movie.credit_id} onPress={() => { setSelectedActor(null); openDetails(movie); }} style={{width: 120, marginBottom: 16}}>
                                 <Image source={{uri: `https://image.tmdb.org/t/p/w300${movie.poster_path}`}} style={{width: 120, height: 180, borderRadius: 12, backgroundColor: glassBackground, marginBottom: 8}} />
                                 <Text style={{color: '#fff', fontSize: 13, fontWeight: 'bold'}} numberOfLines={2}>{movie.title || movie.name}</Text>
                                 <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 11}} numberOfLines={1}>{movie.character}</Text>
                              </TouchableOpacity>
                           ))}
                        </View>
                     </View>
                  </ScrollView>
               </View>
            </View>
         )}
      </Modal>

      {/* FILTER MODAL */}
      <Modal visible={showFiltersModal} animationType="slide" transparent={true}>
         <View style={styles.modalContainer}>
            <View style={[styles.modalContent, { padding: 32, maxWidth: 600 }]}>
               <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24}}>
                  <Text style={{fontSize: 24, color: '#fff', fontWeight: 'bold'}}>Filter Watchlist</Text>
                  <TouchableOpacity onPress={() => setShowFiltersModal(false)}><Text style={{color: '#fff', fontSize: 24}}>✕</Text></TouchableOpacity>
               </View>

               <Text style={{color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: 12}}>STREAMING PLATFORM</Text>
               <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32}}>
                  {PLATFORMS.map(ott => (
                     <TouchableOpacity key={ott} style={[styles.genreChip, filterOtt === ott && styles.genreChipActive]} onPress={() => setFilterOtt(ott)}>
                        <Text style={[styles.genreText, filterOtt === ott && styles.genreTextActive]}>{ott === 'All' ? 'Any Platform' : ott}</Text>
                     </TouchableOpacity>
                  ))}
               </View>

               <Text style={{color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', marginBottom: 12}}>ORIGINAL LANGUAGE</Text>
               <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32}}>
                  {LANGUAGES.map(lang => (
                     <TouchableOpacity key={lang.code} style={[styles.genreChip, filterLang === lang.code && styles.genreChipActive]} onPress={() => setFilterLang(lang.code)}>
                        <Text style={[styles.genreText, filterLang === lang.code && styles.genreTextActive]}>{lang.name}</Text>
                     </TouchableOpacity>
                  ))}
               </View>

               <View style={{flexDirection: 'row', gap: 16}}>
                  <TouchableOpacity style={[styles.primaryBtn, {flex: 1}]} onPress={() => setShowFiltersModal(false)}>
                     <Text style={styles.primaryBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.glassBtnSmall, {flex: 1, height: 56, justifyContent: 'center'}]} onPress={() => { setFilterOtt('All'); setFilterLang('All'); }}>
                     <Text style={styles.glassBtnText}>Reset</Text>
                  </TouchableOpacity>
               </View>
            </View>
         </View>
      </Modal>

      {/* FULL SCREEN DETAILS MODAL */}
      <Modal visible={!!selectedDetails} animationType="slide" transparent={true}>
         {selectedDetails && (
            <View style={styles.modalContainer}>
               <View style={styles.modalContent}>
                  <TouchableOpacity style={styles.closeBtn} onPress={() => setSelectedDetails(null)}>
                     <Text style={{color: '#fff', fontSize: 18, fontWeight: 'bold'}}>✕</Text>
                  </TouchableOpacity>
                  
                  <ScrollView showsVerticalScrollIndicator={false}>
                     <View style={styles.modalHero}>
                        <Image 
                           source={{uri: selectedDetails.backdrop_path || selectedDetails.poster_path ? `https://image.tmdb.org/t/p/original${selectedDetails.backdrop_path || selectedDetails.poster_path}` : `https://via.placeholder.com/1920x1080/1e293b/ffffff?text=No+Backdrop`}} 
                           style={StyleSheet.absoluteFillObject} 
                        />
                        <View style={styles.modalGradient} />
                     </View>

                     <View style={styles.modalBody}>
                        <Text style={styles.modalTitle}>{selectedDetails.title || selectedDetails.name}</Text>
                        <Text style={styles.modalMeta}>
                           {selectedDetails.media_type?.toUpperCase()} • {selectedDetails.release_date || selectedDetails.first_air_date} • ⭐ {selectedDetails.vote_average?.toFixed(1)}
                        </Text>
                        <Text style={styles.modalOverview}>{selectedDetails.overview}</Text>
                        
                        {selectedDetails.credits && selectedDetails.credits.length > 0 && (
                           <View style={{marginTop: 24}}>
                              <Text style={{color: '#fff', fontWeight: 'bold', marginBottom: 12, letterSpacing: 1}}>TOP CAST</Text>
                              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{flexDirection: 'row'}}>
                                 {selectedDetails.credits.map((actor: any) => (
                                    <TouchableOpacity key={actor.id} onPress={() => fetchActorFilmography(actor)} style={{alignItems: 'center', width: 90, marginRight: 16}}>
                                       {actor.profile_path ? (
                                          <Image source={{uri: `https://image.tmdb.org/t/p/w185${actor.profile_path}`}} style={{width: 70, height: 70, borderRadius: 35, marginBottom: 8, borderWidth: 1, borderColor: glassBorder}} />
                                       ) : (
                                          <View style={{width: 70, height: 70, borderRadius: 35, backgroundColor: glassBackground, marginBottom: 8, borderWidth: 1, borderColor: glassBorder}} />
                                       )}
                                       <Text style={{color: '#cbd5e1', fontSize: 11, textAlign: 'center', fontWeight: '600'}} numberOfLines={2}>{actor.name}</Text>
                                       <Text style={{color: 'rgba(255,255,255,0.5)', fontSize: 10, textAlign: 'center'}} numberOfLines={1}>{actor.character}</Text>
                                    </TouchableOpacity>
                                 ))}
                              </ScrollView>
                           </View>
                        )}

                        <View style={{flexDirection: 'row', gap: 12, marginVertical: 24}}>
                           {!selectedDetails.showProviders ? (
                              <TouchableOpacity style={styles.modalBtnPrimary} onPress={() => fetchDetailsProviders(selectedDetails)}>
                                 {detailsProvidersLoading ? <ActivityIndicator color="#000" /> : <Text style={styles.modalBtnTextPrimary}>Watch Options</Text>}
                              </TouchableOpacity>
                           ) : null}

                           {!isReadOnly && (
                              <TouchableOpacity style={styles.modalBtnSecondary} onPress={() => toggleWatchlist(selectedDetails)}>
                                 <Text style={styles.modalBtnTextSecondary}>{isInWatchlist(selectedDetails.id) ? '★ Saved to List' : '☆ Save to List'}</Text>
                              </TouchableOpacity>
                           )}
                        </View>

                        {selectedDetails.showProviders && (
                           <View style={styles.modalProviders}>
                              <Text style={{color: 'rgba(255,255,255,0.5)', marginBottom: 12, fontWeight: 'bold', letterSpacing: 1}}>AVAILABLE ON</Text>
                              {selectedDetails.providers?.length > 0 ? (
                                 <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 12}}>
                                    {selectedDetails.providers.map((p: any) => (
                                       <TouchableOpacity key={p.provider_id} onPress={() => openProvider(p.provider_name, selectedDetails.title || selectedDetails.name)}>
                                          <Image source={{ uri: `https://image.tmdb.org/t/p/w200${p.logo_path}` }} style={styles.modalProviderLogo} />
                                       </TouchableOpacity>
                                    ))}
                                 </View>
                              ) : (
                                 <Text style={{color: '#fbbf24', fontSize: 14}}>
                                    {new Date(selectedDetails.release_date || selectedDetails.first_air_date) > new Date() 
                                       ? `Theatrical Release: ${selectedDetails.release_date || selectedDetails.first_air_date}` 
                                       : `Not yet streaming in your region. (Released: ${selectedDetails.release_date || selectedDetails.first_air_date})`}
                                 </Text>
                              )}
                           </View>
                        )}
                     </View>
                  </ScrollView>
               </View>
            </View>
         )}
      </Modal>

      <View style={{flex: 1, flexDirection: isDesktop ? 'row' : 'column'}}>
         {isDesktop && renderSidebar()}

         <View style={styles.mainArea}>
            {(activeTab === 'discover' || activeTab === 'watchlist') && (
               <View style={[styles.topBar, !isDesktop && { flexDirection: 'column', alignItems: 'stretch', gap: 16 }]}>
                  {!isDesktop && (
                     <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
                        <Text style={styles.mobileLogo}>CINEFILE</Text>
                        {!isReadOnly && (
                           <TouchableOpacity onPress={() => setShowAlerts(!showAlerts)} style={{padding: 8, position: 'relative'}}>
                              <Text style={{fontSize: 20}}>🔔</Text>
                              {notifications.length > 0 && <View style={styles.notificationDot} />}
                           </TouchableOpacity>
                        )}
                     </View>
                  )}
                  {!isReadOnly && (
                     <View style={styles.searchContainer}>
                        <TextInput style={styles.searchInput} placeholder="Search movies, tv, actors..." placeholderTextColor="rgba(255,255,255,0.5)" value={query} onChangeText={setQuery} />
                        
                        {query.length > 0 && (
                           <TouchableOpacity onPress={() => setQuery('')} style={styles.iconBtn}>
                              <Text style={styles.iconText}>✕</Text>
                           </TouchableOpacity>
                        )}
                        
                        <View style={styles.verticalDivider} />
                        <TouchableOpacity onPress={startVoiceSearch} style={styles.iconBtn}>
                           <Text style={styles.iconText}>{isListening ? '🔴' : '🎤'}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setShowLangDropdown(!showLangDropdown)} style={styles.iconBtn}>
                           <Text style={styles.langText}>{speechLanguage.split('-')[0].toUpperCase()}</Text>
                        </TouchableOpacity>
                     </View>
                  )}
               </View>
            )}

            {showLangDropdown && (
               <View style={styles.langDropdown}>
                  {[{ code: 'en-US', label: 'English' }, { code: 'hi-IN', label: 'Hindi' }, { code: 'te-IN', label: 'Telugu' }, { code: 'ta-IN', label: 'Tamil' }, { code: 'es-ES', label: 'Spanish' }].map(lang => (
                     <TouchableOpacity key={lang.code} style={styles.langOption} onPress={() => { setSpeechLanguage(lang.code); setShowLangDropdown(false); }}>
                        <Text style={{color: '#fff', fontWeight: speechLanguage === lang.code ? 'bold' : 'normal'}}>{lang.label}</Text>
                     </TouchableOpacity>
                  ))}
               </View>
            )}

            {showAlerts && (
               <View style={styles.alertsDropdown}>
                  <Text style={styles.alertsTitle}>Recent Updates</Text>
                  {notifications.length === 0 ? <Text style={{color: 'rgba(255,255,255,0.5)'}}>No new releases.</Text> : 
                     notifications.map((msg, i) => <View key={i} style={styles.alertItem}><Text style={styles.alertText}>{msg}</Text></View>)
                  }
               </View>
            )}

            {activeTab === 'profile' && !isReadOnly && (
               <View style={styles.profileContainer}>
                  <View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{formattedName.charAt(0)}</Text></View>
                  <Text style={styles.profileName}>Welcome, {formattedName}</Text>
                  <Text style={styles.profileStats}>You have {watchlist.length} titles saved in your watchlist.</Text>
                  
                  <View style={{flexDirection: 'row', gap: 16}}>
                     <TouchableOpacity style={styles.shareBtn} onPress={copyShareLink}>
                        <Text style={styles.shareBtnText}>🔗 Share Watchlist</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={styles.logoutBtn} onPress={() => supabase.auth.signOut()}>
                        <Text style={styles.logoutBtnText}>Sign Out</Text>
                     </TouchableOpacity>
                  </View>
               </View>
            )}

            {activeTab === 'discover' && isQueryEmpty && !isReadOnly && (
               <View style={styles.filtersWrapper}>
                  <View style={styles.segmentedControl}>
                     <TouchableOpacity style={[styles.segmentBtn, discoverType === 'movie' && styles.segmentBtnActive]} onPress={() => setDiscoverType('movie')}>
                        <Text style={[styles.segmentText, discoverType === 'movie' && styles.segmentTextActive]}>Movies</Text>
                     </TouchableOpacity>
                     <TouchableOpacity style={[styles.segmentBtn, discoverType === 'tv' && styles.segmentBtnActive]} onPress={() => setDiscoverType('tv')}>
                        <Text style={[styles.segmentText, discoverType === 'tv' && styles.segmentTextActive]}>TV Shows</Text>
                     </TouchableOpacity>
                  </View>

                  <ScrollView 
                     horizontal 
                     showsHorizontalScrollIndicator={false} 
                     style={isDesktop ? { alignSelf: 'center' } : {}}
                     contentContainerStyle={styles.genreScroll}
                  >
                     {[{id: '', name: 'All Genres'}, {id: '28', name: 'Action'}, {id: '35', name: 'Comedy'}, {id: '18', name: 'Drama'}, {id: '878', name: 'Sci-Fi'}].map(g => (
                        <TouchableOpacity key={g.id} style={[styles.genreChip, discoverGenre === g.id && styles.genreChipActive]} onPress={() => setDiscoverGenre(g.id)}>
                           <Text style={[styles.genreText, discoverGenre === g.id && styles.genreTextActive]}>{g.name}</Text>
                        </TouchableOpacity>
                     ))}
                  </ScrollView>
               </View>
            )}

            {activeTab === 'watchlist' && watchlist.length > 0 && (
               <View style={styles.filtersWrapper}>
                  <View style={{flexDirection: 'row', gap: 12, alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap'}}>
                     <View style={styles.segmentedControl}>
                        <TouchableOpacity style={[styles.segmentBtn, filterType === 'All' && styles.segmentBtnActive]} onPress={() => setFilterType('All')}>
                           <Text style={[styles.segmentText, filterType === 'All' && styles.segmentTextActive]}>All Types</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.segmentBtn, filterType === 'Movie' && styles.segmentBtnActive]} onPress={() => setFilterType('Movie')}>
                           <Text style={[styles.segmentText, filterType === 'Movie' && styles.segmentTextActive]}>Movies</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.segmentBtn, filterType === 'TV' && styles.segmentBtnActive]} onPress={() => setFilterType('TV')}>
                           <Text style={[styles.segmentText, filterType === 'TV' && styles.segmentTextActive]}>TV Shows</Text>
                        </TouchableOpacity>
                     </View>
                     
                     <TouchableOpacity style={styles.filterMenuBtn} onPress={() => setShowFiltersModal(true)}>
                        <Text style={styles.filterMenuBtnText}>
                           ⚙️ Filters {(filterOtt !== 'All' || filterLang !== 'All') && ' 🔴'}
                        </Text>
                     </TouchableOpacity>
                  </View>
               </View>
            )}

            {activeTab !== 'profile' && (
               <>
                  {(isSearching || isDiscovering) && <ActivityIndicator size="large" color="#fff" style={{marginTop: 40}} />}
                  
                  {isReadOnly && activeTab === 'watchlist' && (
                     <View style={{padding: 24, paddingBottom: 8}}>
                        <Text style={{fontSize: 24, fontWeight: 'bold', color: '#fff'}}>Shared Watchlist</Text>
                        <Text style={{color: 'rgba(255,255,255,0.6)'}}>Created by a Cinefile user. Sign up to build your own.</Text>
                     </View>
                  )}

                  <FlatList
                     key={`grid-${numColumns}`}
                     data={gridData}
                     numColumns={numColumns}
                     keyExtractor={(item: any, index: number) => item.id.toString() + index}
                     renderItem={renderCinematicCard}
                     contentContainerStyle={styles.gridContainer}
                     columnWrapperStyle={numColumns > 1 ? styles.gridRow : undefined}
                     showsVerticalScrollIndicator={false}
                     ListHeaderComponent={() => isHeroActive ? renderHeroBanner(rawListData[0]) : null}
                  />
               </>
            )}
         </View>
      </View>

      {!isDesktop && renderBottomNav()}
    </SafeAreaView>
  );
}

// --- STYLES ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' }, 
  
  authContainer: { flex: 1, backgroundColor: '#000', padding: 24, justifyContent: 'center', alignItems: 'center' },
  authTitle: { fontSize: 40, fontWeight: '900', color: '#fff', letterSpacing: 4, marginBottom: 8 },
  authSub: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 40 },
  glassPanel: { width: '100%', maxWidth: 400, backgroundColor: glassBackground, padding: 32, borderRadius: 24, borderWidth: 1, borderColor: glassBorder },
  glassInput: { height: 56, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 16, paddingHorizontal: 20, color: '#fff', fontSize: 16, marginBottom: 16, borderWidth: 1, borderColor: glassBorder, textAlign: 'center' },
  primaryBtn: { height: 56, backgroundColor: '#fff', borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  primaryBtnText: { color: '#000', fontSize: 16, fontWeight: '800' },

  sidebar: { width: 260, backgroundColor: glassBackground, borderRightWidth: 1, borderColor: glassBorder, padding: 32 },
  sidebarLogo: { fontSize: 24, fontWeight: '900', color: '#fff', letterSpacing: 2 },
  navItem: { paddingVertical: 12 },
  navItemActive: { borderRightWidth: 3, borderColor: '#fff' },
  navText: { fontSize: 16, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },
  navTextActive: { color: '#fff', fontWeight: '800' },
  
  bottomNav: { height: 80, backgroundColor: glassBackground, borderTopWidth: 1, borderColor: glassBorder, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 20 },
  bottomNavItem: { alignItems: 'center', padding: 8 },
  bottomNavText: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600' },
  bottomNavTextActive: { color: '#fff', fontWeight: '800' },

  mainArea: { flex: 1 },
  
  topBar: { flexDirection: 'row', alignItems: 'center', padding: 16, paddingHorizontal: 24, zIndex: 10 },
  mobileLogo: { fontSize: 20, fontWeight: '900', color: '#fff', letterSpacing: 1, marginRight: 16 },
  searchContainer: { flex: 1, flexDirection: 'row', backgroundColor: glassBackground, borderRadius: 100, borderWidth: 1, borderColor: glassBorder, alignItems: 'center', paddingHorizontal: 16, height: 48, maxWidth: 800, marginHorizontal: 'auto' },
  searchInput: { flex: 1, color: '#fff', fontSize: 16, outlineStyle: 'none' },
  iconBtn: { padding: 8, justifyContent: 'center', alignItems: 'center' },
  iconText: { fontSize: 16, color: '#fff' },
  langText: { fontSize: 14, color: '#fff', fontWeight: 'bold' },
  verticalDivider: { width: 1, height: 20, backgroundColor: glassBorder, marginHorizontal: 8 },
  notificationDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, backgroundColor: '#ef4444', borderRadius: 4 },
  
  filtersWrapper: { paddingBottom: 16, gap: 16 },
  segmentedControl: { alignSelf: 'center', flexDirection: 'row', backgroundColor: glassBackground, borderRadius: 100, padding: 4, borderWidth: 1, borderColor: glassBorder },
  segmentBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 100 },
  segmentBtnActive: { backgroundColor: '#38bdf8' },
  segmentText: { color: 'rgba(255,255,255,0.6)', fontWeight: '700', fontSize: 14 },
  segmentTextActive: { color: '#000', fontWeight: '900' },
  
  filterMenuBtn: { backgroundColor: glassBackground, borderWidth: 1, borderColor: glassBorder, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 100 },
  filterMenuBtnText: { color: '#fff', fontWeight: 'bold' },
  
  genreScroll: { gap: 8, paddingHorizontal: 16 },
  genreChip: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 100, backgroundColor: glassBackground, borderWidth: 1, borderColor: glassBorder },
  genreChipActive: { backgroundColor: '#fff', borderColor: '#fff' },
  genreText: { color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '600' },
  genreTextActive: { color: '#000', fontWeight: '800' },

  gridContainer: { padding: 16, paddingBottom: 100 },
  gridRow: { gap: 16, marginBottom: 16 },

  cinemaCard: { flex: 1, aspectRatio: 2/3, borderRadius: 16, overflow: 'hidden', backgroundColor: '#111', borderWidth: 1, borderColor: glassBorder, marginHorizontal: 4 },
  cardGradient: { position: 'absolute', bottom: 0, width: '100%', height: '45%', backgroundColor: 'rgba(0,0,0,0.85)' },
  cardContent: { position: 'absolute', bottom: 0, width: '100%', padding: 12, height: '45%', justifyContent: 'flex-end' },
  cardTitle: { color: '#fff', fontSize: 14, fontWeight: '800', marginBottom: 2 },
  cardMeta: { color: 'rgba(255,255,255,0.7)', fontSize: 11 },
  
  floatingSaveBtn: { position: 'absolute', top: 12, right: 12, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', zIndex: 10 },
  saveIconLg: { color: '#fff', fontSize: 24, fontWeight: 'bold', marginTop: -2 },
  savedIconLg: { color: '#38bdf8', fontSize: 24, fontWeight: 'bold', marginTop: -2 },

  glassBtnSmall: { backgroundColor: 'rgba(255,255,255,0.1)', paddingVertical: 8, borderRadius: 100, alignItems: 'center', borderWidth: 1, borderColor: glassBorder },
  glassBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  providersGridContainer: { flexDirection: 'row', alignItems: 'center' },
  providerLogoSmall: { width: 32, height: 32, borderRadius: 8, marginRight: 8, borderWidth: 1, borderColor: glassBorder },
  futureText: { color: '#fbbf24', fontSize: 11, fontStyle: 'italic', lineHeight: 16 },

  heroBanner: { width: '100%', height: 450, borderRadius: 24, overflow: 'hidden', marginBottom: 32, backgroundColor: '#111', borderWidth: 1, borderColor: glassBorder },
  heroOverlay: { position: 'absolute', bottom: 0, width: '100%', height: '100%', backgroundColor: 'rgba(0,0,0,0.5)', padding: 40, justifyContent: 'flex-end' },
  heroTitle: { color: '#fff', fontSize: 48, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  heroMeta: { color: '#38bdf8', fontSize: 16, fontWeight: '700', marginBottom: 16 },
  heroOverview: { color: 'rgba(255,255,255,0.8)', fontSize: 16, maxWidth: 600, lineHeight: 24 },
  heroBtnPrimary: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 12, borderRadius: 100 },
  heroBtnTextPrimary: { color: '#000', fontSize: 16, fontWeight: '800' },
  heroBtnSecondary: { backgroundColor: glassBackground, borderWidth: 1, borderColor: glassBorder, paddingHorizontal: 32, paddingVertical: 12, borderRadius: 100, marginLeft: 12 },
  heroBtnTextSecondary: { color: '#fff', fontSize: 16, fontWeight: '800' },

  profileContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  profileAvatar: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#38bdf8', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  profileAvatarText: { fontSize: 48, color: '#000', fontWeight: '900' },
  profileName: { fontSize: 32, color: '#fff', fontWeight: '800', marginBottom: 8 },
  profileStats: { fontSize: 16, color: 'rgba(255,255,255,0.6)', marginBottom: 40 },
  shareBtn: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 100 },
  shareBtnText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  logoutBtn: { backgroundColor: '#ef4444', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 100 },
  logoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },

  langDropdown: { position: 'absolute', right: 24, top: 70, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: glassBorder, padding: 8, zIndex: 20 },
  langOption: { padding: 12, borderBottomWidth: 1, borderBottomColor: glassBorder },
  alertsDropdown: { position: 'absolute', right: 24, top: 70, width: 300, backgroundColor: '#111', borderRadius: 16, borderWidth: 1, borderColor: glassBorder, padding: 16, zIndex: 100 },
  alertsTitle: { color: '#fff', fontWeight: 'bold', marginBottom: 12, fontSize: 16 },
  alertItem: { backgroundColor: glassBackground, padding: 12, borderRadius: 12, marginBottom: 8 },
  alertText: { color: 'rgba(255,255,255,0.9)', fontSize: 13, lineHeight: 18 },

  modalContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { width: '100%', maxWidth: 800, maxHeight: '90%', backgroundColor: '#111', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: glassBorder },
  closeBtn: { position: 'absolute', top: 16, right: 16, width: 40, height: 40, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20, justifyContent: 'center', alignItems: 'center', zIndex: 10 },
  modalHero: { width: '100%', height: 400, backgroundColor: '#222' },
  modalGradient: { position: 'absolute', bottom: 0, width: '100%', height: '100%', backgroundColor: 'rgba(17,17,17,0.7)' },
  modalBody: { padding: 32, marginTop: -100 },
  modalTitle: { fontSize: 40, color: '#fff', fontWeight: '900', marginBottom: 8 },
  modalMeta: { fontSize: 14, color: '#38bdf8', fontWeight: '700', marginBottom: 16 },
  modalOverview: { fontSize: 16, color: 'rgba(255,255,255,0.8)', lineHeight: 24 },
  
  modalBtnPrimary: { backgroundColor: '#fff', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  modalBtnTextPrimary: { color: '#000', fontSize: 16, fontWeight: '800' },
  modalBtnSecondary: { backgroundColor: glassBackground, borderWidth: 1, borderColor: glassBorder, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 100, justifyContent: 'center', alignItems: 'center' },
  modalBtnTextSecondary: { color: '#fff', fontSize: 16, fontWeight: '800' },
  
  modalProviders: { marginTop: 16, padding: 24, backgroundColor: glassBackground, borderRadius: 16, borderWidth: 1, borderColor: glassBorder },
  modalProviderLogo: { width: 56, height: 56, borderRadius: 12, borderWidth: 1, borderColor: glassBorder }
});
