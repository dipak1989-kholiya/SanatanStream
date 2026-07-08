import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, collection } from 'firebase/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Read config
const configPath = join(process.cwd(), 'firebase-applet-config.json');
const firebaseConfig = JSON.parse(readFileSync(configPath, 'utf8'));

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Data to seed
const SEED_VIDEOS = [
  {
    id: "yt_1",
    title: "Mahamrityunjaya Mantra - 108 Times Chanting",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=HP_9InU7Z6k",
    description: "The great death-conquering mantra of Lord Shiva, chanted 108 times for health, protection, and spiritual awakening.",
    thumbnail: "https://images.unsplash.com/photo-1602192103300-47e66756152e?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_2",
    title: "Gayatri Mantra - Sacred Vedic Chanting",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=S18E70_a2sc",
    description: "The highly revered Gayatri Mantra, chanted with pristine Vedic pronunciation to illuminate the intellect.",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_3",
    title: "Achyutam Keshavam - Beautiful Krishna Bhajan",
    category: "Bhajans",
    url: "https://www.youtube.com/watch?v=C7gNfIq2WRE",
    description: "A sweet, peaceful, and deeply devotional song dedicated to Lord Krishna and Lord Rama, perfect for daily meditation.",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_4",
    title: "Shiv Tandav Stotram - Divine Energetic Chant",
    category: "Bhajans",
    url: "https://www.youtube.com/watch?v=v_b867S3S68",
    description: "A powerful, energetic chanting of the Shiv Tandav Stotram, composed by Ravana to praise the cosmic dance of Lord Shiva.",
    thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_5",
    title: "Om Namah Shivaya - Meditative Shiva Chant",
    category: "Meditation",
    url: "https://www.youtube.com/watch?v=N_Sg73u95_I",
    description: "Deep, slow chanting of the Panchakshara Shiva mantra 'Om Namah Shivaya' to ground your mind and enter deep silence.",
    thumbnail: "https://images.unsplash.com/photo-1602192103300-47e66756152e?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_6",
    title: "Hanuman Chalisa - Powerful Devotional Prayer",
    category: "Bhajans",
    url: "https://www.youtube.com/watch?v=9_tU8m8mBv8",
    description: "A melodious and spirited singing of the Hanuman Chalisa to invoke courage, strength, and protection.",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_7",
    title: "Vedic Peace Mantra - Om Shanti Shanti Shanti",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=M9-2A2Msh_U",
    description: "Ancient Shanti mantras from the Upanishads, praying for peace in the universe, the environment, and our inner self.",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_8",
    title: "Hare Krishna Maha Mantra - Chanting Meditation",
    category: "Meditation",
    url: "https://www.youtube.com/watch?v=vVka25p3Sow",
    description: "A soothing and ecstatic rendering of the Maha Mantra for deep bhaktyoga practice and spiritual cleansing.",
    thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_9",
    title: "Sri Vishnu Sahasranamam - 1000 Names of Vishnu",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=zVb826O_t-0",
    description: "Recitation of the thousand sacred names of Lord Vishnu, bringing immense mental clarity, prosperity, and peace.",
    thumbnail: "https://images.unsplash.com/photo-1602192103300-47e66756152e?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_10",
    title: "Ganesh Atharvashirsha - Powerful Ganesha Prayer",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=Dx86Gg6Y9F0",
    description: "The sacred Atharvashirsha text dedicated to Lord Ganesha, removing all obstacles and bringing wisdom.",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_11",
    title: "Sacred Ganga Aarti Live - Rishikesh Devotion",
    category: "Spiritual",
    url: "https://www.youtube.com/watch?v=ZfAAnC1bV58",
    description: "The mesmerizing daily Ganga Aarti at Rishikesh, complete with oil lamps, Vedic chants, and divine atmosphere.",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_12",
    title: "The Essence of Bhagavad Gita - Spiritual Wisdom",
    category: "Spiritual",
    url: "https://www.youtube.com/watch?v=vVvX96_6W-0",
    description: "A spiritual discourse breaking down the key chapters and teachings of the Bhagavad Gita for daily life.",
    thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_13",
    title: "Ancient Rudram Chanting - Powerful Shiva Prayers",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=6h24r_X-vj0",
    description: "Sri Rudram, one of the oldest sacred Vedic hymns dedicated to Lord Rudra (Shiva), for world peace and purification.",
    thumbnail: "https://images.unsplash.com/photo-1602192103300-47e66756152e?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_14",
    title: "Divine flute music of Vrindavan - Deep Calm",
    category: "Meditation",
    url: "https://www.youtube.com/watch?v=6v4mP04_A0w",
    description: "Soothing bansuri (flute) melodies depicting the divine landscapes of Vrindavan, perfect for deep sleep and focus.",
    thumbnail: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_15",
    title: "Shri Ram Chandra Kripalu Bhajman - Divine Kirtan",
    category: "Bhajans",
    url: "https://www.youtube.com/watch?v=0h6v8U_tLzo",
    description: "Goswami Tulsidas's highly popular and devotional prayer praising the compassionate and divine form of Lord Rama.",
    thumbnail: "https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=640&auto=format&fit=crop"
  },
  {
    id: "yt_16",
    title: "Lalitha Sahasranamam - Meditative Chant",
    category: "Mantras",
    url: "https://www.youtube.com/watch?v=8mBv8-3S8_g",
    description: "The 1000 names of the Divine Mother Lalitha Tripurasundari, bringing infinite grace, health, and prosperity.",
    thumbnail: "https://images.unsplash.com/photo-1518241353330-0f7941c2d9b5?q=80&w=640&auto=format&fit=crop"
  }
];

const SEED_CATEGORIES = ["Meditation", "Mantras", "Bhajans", "Spiritual"];

async function run() {
  try {
    console.log("Starting unauthenticated seeding to Firestore...");

    console.log("Seeding categories...");
    for (const cat of SEED_CATEGORIES) {
      const docRef = doc(collection(db, "categories"), cat);
      await setDoc(docRef, { name: cat });
      console.log(`Seeded category: ${cat}`);
    }

    console.log("Seeding videos...");
    for (const video of SEED_VIDEOS) {
      const docRef = doc(collection(db, "videos"), video.id);
      await setDoc(docRef, {
        id: video.id,
        title: video.title,
        url: video.url,
        category: video.category,
        description: video.description,
        thumbnail: video.thumbnail,
        type: "youtube",
        createdAt: new Date()
      });
      console.log(`Seeded video: ${video.title}`);
    }

    console.log("Seeding completed successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

run();
