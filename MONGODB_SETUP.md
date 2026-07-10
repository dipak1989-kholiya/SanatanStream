# MongoDB Atlas Database Setup for SanatanStream / સનાતનસ્ટ્રીમ મોંગોડીબી સેટઅપ ગાઇડ

This guide will walk you through setting up a **MongoDB Atlas (Free Tier)** database and connecting it to your deployment on **Vercel** or your local development environment.

આ માર્ગદર્શિકા તમને **MongoDB Atlas (Free Tier)** સેટ કરવા અને તેને **Vercel** અથવા સ્થાનિક વાતાવરણ સાથે જોડવામાં મદદ કરશે.

---

## Step 1: Create a Free MongoDB Atlas Account / પગલું 1: ફ્રી મોંગોડીબી એટલાસ એકાઉન્ટ બનાવો

1. Go to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) and register for a free account.
   - [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register) પર જાઓ અને મફત એકાઉન્ટ રજીસ્ટર કરો.
2. Choose **M0 (Free Tier)** when prompted to select a cluster type.
   - જ્યારે ક્લસ્ટર પ્રકાર પસંદ કરવાનું પૂછવામાં આવે ત્યારે **M0 (Free Tier)** પસંદ કરો.
3. Select your preferred Cloud Provider (e.g., AWS or Google Cloud) and region closest to your server (e.g., Mumbai, Singapore).
   - તમારો મનપસંદ ક્લાઉડ પ્રોવાઇડર (દા.ત., AWS અથવા Google Cloud) અને પ્રદેશ પસંદ કરો.
4. Click **Create Deployment** or **Create Cluster**.
   - **Create Deployment** અથવા **Create Cluster** પર ક્લિક કરો.

---

## Step 2: Configure Database Security / પગલું 2: ડેટાબેઝ સુરક્ષા ગોઠવો

During or after cluster creation, you will set up authentication:
ક્લસ્ટર બનાવતી વખતે અથવા પછી, તમે કનેક્શન સેટઅપ કરશો:

1. **Create a Database User**:
   - Choose **Username and Password** authentication.
   - Create a username (e.g., `dbAdmin`) and a strong password. **Write down this password!**
   - **એક ડેટાબેઝ યુઝર બનાવો**: યુઝરનેમ (દા.ત., `dbAdmin`) અને સ્ટ્રોંગ પાસવર્ડ બનાવો. આ પાસવર્ડ સાચવીને રાખો!
2. **Configure IP Access List (Network Access)**:
   - To make it compatible with **Vercel's serverless environment**, you must allow access from anywhere.
   - Click on **Network Access** under the security section in the left sidebar.
   - Click **Add IP Address** and choose **Allow Access From Anywhere** (IP: `0.0.0.0/0`).
   - Click **Confirm**.
   - **IP એક્સેસ લિસ્ટ ગોઠવો**: ડાબી બાજુના **Network Access** પર ક્લિક કરો. **Add IP Address** પર ક્લિક કરો અને **Allow Access From Anywhere** (IP: `0.0.0.0/0`) પસંદ કરો, જેથી Vercel સર્વર કોઈપણ સમસ્યા વિના જોડાણ સ્થાપિત કરી શકે.

---

## Step 3: Get Connection URI / પગલું 3: કનેક્શન કી (URI) મેળવો

1. Go to your Atlas Dashboard and click on your cluster's **Connect** button.
   - ડેશબોર્ડ પર જઈને તમારા ક્લસ્ટરના **Connect** બટન પર ક્લિક કરો.
2. Select **Drivers** (usually under "Connect to your application").
   - **Drivers** વિકલ્પ પસંદ કરો.
3. Copy the connection string. It will look like this:
   કનેક્શન લિંક કોપી કરો. તે નીચે મુજબ દેખાશે:
   ```text
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0
   ```
4. Replace `<password>` with the actual database password you created in Step 2. (Remove the `<` and `>` brackets).
   - `<password>` ના બદલે તમારો અસલી ડેટાબેઝ પાસવર્ડ ઉમેરો (બ્રેકેટ્સ `<>` હટાવીને).

---

## Step 4: Configure on Vercel / પગલું 4: Vercel પર કનેક્ટ કરો

To store all your data permanently online, add the connection URI as an environment variable in your Vercel Dashboard:
તમારો બધો ડેટા કાયમી ધોરણે ઓનલાઈન સ્ટોર કરવા માટે, Vercel ડેશબોર્ડ પર નીચે પ્રમાણે એનવાયરમેન્ટ વેરીએબલ ઉમેરો:

1. Open your project on **Vercel**.
   - **Vercel** પર તમારો પ્રોજેક્ટ ઓપન કરો.
2. Go to **Settings** > **Environment Variables**.
   - **Settings** > **Environment Variables** મેનૂમાં જાઓ.
3. Add a new variable:
   - **Key / Name**: `MONGODB_URI`
   - **Value**: *(Paste your copied MongoDB connection string with your actual password)*
4. Click **Save** and **Redeploy** your project.
   - **Save** પર ક્લિક કરો અને પ્રોજેક્ટને ફરીથી **Redeploy** કરો.

---

## Step 5: Initialize & Seed Database / પગલું 5: ડેટાબેઝ શરૂ કરો અને સીડ કરો

Once the Vercel app is redeployed and connected:
એકવાર Vercel એપ ફરીથી ડિપ્લોય થઈ જાય પછી:

1. Log in as an administrator on **SanatanStream** using:
   - **Email / ઇમેઇલ**: `dipak.kholiya@gmail.com`
   - **Password / પાસવર્ડ**: `Dipak@3626`
2. Since the MongoDB database is initially empty, log in will automatically trigger the initial seed to load the **16 default master videos** and **6 devotional categories** straight into your MongoDB Atlas cloud instance!
3. All future videos added, edited, or deleted through the Admin Dashboard will instantly sync with your MongoDB Atlas database online!
   - તમામ ડેટા હવેથી સીધો જ મોંગોડીબી એટલાસ ક્લાઉડમાં સેવ થશે!
