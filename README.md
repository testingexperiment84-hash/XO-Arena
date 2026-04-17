# 🎮 XO Arena

![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Vite](https://img.shields.io/badge/vite-%23646CFF.svg?style=for-the-badge&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Firebase](https://img.shields.io/badge/firebase-%23039BE5.svg?style=for-the-badge&logo=firebase)

**XO Arena** is a modern, production-ready, advanced Tic Tac Toe web game. It takes the classic game and elevates it with dynamic grids, power-ups, AI opponents, deep customization, and a global leaderboard.

---

## 🌍 Deployment Guide (Vercel & Netlify)

This project is already perfectly configured for seamless deployment to modern hosting platforms. The necessary configuration files (`vercel.json` and `netlify.toml`) are already included in the root directory to handle Single Page Application (SPA) routing.

### Step 1: Push to GitHub

Before deploying, you need to push your code to a GitHub repository. Open your terminal in the project folder and run these commands:

```bash
# 1. Initialize a new Git repository
git init

# 2. Add all your files to the staging area
git add .

# 3. Commit the files
git commit -m "Initial commit: Ready for deployment"

# 4. Create a new repository on GitHub (leave it empty, no README/license)
# 5. Link your local repository to GitHub (replace URL with your actual repo URL)
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 6. Push your code to GitHub
git branch -M main
git push -u origin main
```

### Step 2: Deploy to Vercel (Option A)

Vercel is highly optimized for Vite and React applications.

1. Go to [Vercel.com](https://vercel.com/) and sign in with your GitHub account.
2. Click **Add New...** > **Project**.
3. Find your newly created GitHub repository in the list and click **Import**.
4. Vercel will automatically detect that it's a **Vite** project.
5. The build settings are automatically configured:
   * **Build Command:** `npm run build`
   * **Output Directory:** `dist`
6. Click **Deploy**.
7. *Note: The `vercel.json` file included in this project automatically handles page routing so your app works perfectly.*

### Step 3: Deploy to Netlify (Option B)

Netlify is another excellent, free hosting platform for React apps.

1. Go to [Netlify.com](https://www.netlify.com/) and sign in with your GitHub account.
2. Click **Add new site** > **Import an existing project**.
3. Choose **GitHub** and authorize Netlify if prompted.
4. Select your repository from the list.
5. Netlify will automatically read the `netlify.toml` file included in this project, which sets up the build command (`npm run build`), the publish directory (`dist`), and the routing redirects.
6. Click **Deploy site**.

---

## 🛠️ Local Development

To run this project locally on your own computer:

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Start the development server:**
   ```bash
   npm run dev
   ```

3. **Build for production:**
   ```bash
   npm run build
   ```

---
*Built with ❤️ for the modern web.*
