const { Octokit } = require("octokit");
const { MongoClient } = require('mongodb');
require('dotenv').config();

const token = process.env.GITHUB_TOKEN; // Replace with your personal access token from GitHub
const uri = process.env.MONGODB_URI; // Replace with your MongoDB connection string

// Create an instance of Octokit with authentication
const octokit = new Octokit({
  auth: token
});

const mongodb = new MongoClient(uri, {
  serverApi: {
    version: '1',
    strict: true,
    deprecationErrors: true,
  }
});

// Connect to the MongoDB database
async function connectToDatabase() {
  try {
    await mongodb.connect();
    console.log('Connected to the database');
  } catch (error) {
    console.error('Error connecting to the database:', error);
  }
}

// Fetch the list of public repositories with a specific topic
async function fetchRepositoriesWithTopic(topic) {
  try {
    const response = await octokit.request("GET /user/repos", {
      per_page: 100, // adjust as necessary
      visibility: 'public', // Fetch only public repositories
      affiliation: 'owner', // Only repositories owned by the authenticated user
    });

    const repositories = response.data.filter(repo => {
      return repo.topics.includes(topic); // Include repositories with 'portfolio-project' topic
    });

    // Fetch repository details including all topics
    const detailedRepositories = await Promise.all(repositories.map(async repo => {
      const detailedResponse = await octokit.request(`GET /repos/${repo.owner.login}/${repo.name}`);
      const technologies = detailedResponse.data.topics.filter(topic => topic !== 'portfolio-project'); // Exclude 'portfolio-project' from technologies
      return {
        name: repo.name,
        repository_link: repo.html_url,
        description: detailedResponse.data.description, // Include description
        technologies: technologies // Include technologies
      };
    }));

    return detailedRepositories;
  } catch (error) {
    console.error("Error fetching repositories:", error.message);
    return [];
  }
}

async function updateDatabase() {
  try {
    // Access the database and collection
    const database = mongodb.db('Project-Data'); // Replace 'Project-Data' with your database name
    const collection = database.collection('Project-Data'); // Replace 'Project-Data' with your collection name

    // Fetch repositories with the topic "portfolio-project"
    const repositories = await fetchRepositoriesWithTopic('portfolio-project'); // Replace 'portfolio-project' with your desired topic

    // Clear the existing documents in the collection
    await collection.deleteMany({});

    // Insert new documents into the collection
    await collection.insertMany(repositories);

    console.log('Database updated successfully');
  } catch (error) {
    console.error('Error updating database:', error);
  }

  await mongodb.close(); // Close the database connection
  process.exit(0); // Exit the process
}

async function run() {
  await connectToDatabase();
  await updateDatabase();
}

run();