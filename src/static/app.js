document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const loginForm = document.getElementById("login-form");
  const authActions = document.getElementById("auth-actions");
  const authStatus = document.getElementById("auth-status");
  const messageDiv = document.getElementById("message");

  let authToken = localStorage.getItem("authToken");
  let currentUser = null;

  function showMessage(text, type, element) {
    element.textContent = text;
    element.className = `message ${type}`;
    element.classList.remove("hidden");
    setTimeout(() => {
      element.classList.add("hidden");
    }, 5000);
  }

  function updateAuthUI() {
    authActions.innerHTML = "";

    if (currentUser) {
      const logoutButton = document.createElement("button");
      logoutButton.id = "logout-button";
      logoutButton.textContent = "Log Out";
      logoutButton.type = "button";
      logoutButton.addEventListener("click", handleLogout);
      authActions.appendChild(logoutButton);
      loginForm.classList.add("hidden");
      authStatus.textContent = `Logged in as ${currentUser.username} (${currentUser.role})`;
      authStatus.className = "message info";
      authStatus.classList.remove("hidden");
    } else {
      loginForm.classList.remove("hidden");
      authStatus.classList.add("hidden");
    }
  }

  async function refreshAuthState() {
    if (!authToken) {
      currentUser = null;
      updateAuthUI();
      return;
    }

    try {
      const response = await fetch("/auth/me", {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        authToken = null;
        currentUser = null;
        localStorage.removeItem("authToken");
        updateAuthUI();
        return;
      }

      currentUser = await response.json();
      updateAuthUI();
    } catch (error) {
      console.error("Error refreshing auth state:", error);
      authToken = null;
      currentUser = null;
      localStorage.removeItem("authToken");
      updateAuthUI();
    }
  }

  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      activitiesList.innerHTML = "";
      activitySelect.innerHTML = '<option value="">-- Select an activity --</option>';

      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft = details.max_participants - details.participants.length;
        const showDeleteButtons = currentUser && currentUser.role === "teacher";

        const participantsHTML = details.participants.length > 0
          ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) =>
                      `<li><span class="participant-email">${email}</span>${showDeleteButtons ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>` : ""}</li>`
                  )
                  .join("")}
              </ul>
              ${!showDeleteButtons ? `<p class="info-note">Log in as a teacher to unregister students.</p>` : ""}
            </div>`
          : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      document.querySelectorAll(".delete-btn").forEach((button) => {
        button.addEventListener("click", handleUnregister);
      });
    } catch (error) {
      activitiesList.innerHTML = "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!authToken) {
      showMessage("Please log in as a teacher to unregister students.", "error", messageDiv);
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/unregister?email=${encodeURIComponent(email)}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success", messageDiv);
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error", messageDiv);
      }
    } catch (error) {
      showMessage("Failed to unregister. Please try again.", "error", messageDiv);
      console.error("Error unregistering:", error);
    }
  }

  async function handleLogout() {
    try {
      await fetch("/auth/logout", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });
    } catch (error) {
      console.error("Error logging out:", error);
    }

    authToken = null;
    currentUser = null;
    localStorage.removeItem("authToken");
    updateAuthUI();
    fetchActivities();
    showMessage("Logged out successfully.", "success", authStatus);
  }

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username, password }),
      });

      const result = await response.json();
      if (response.ok) {
        authToken = result.token;
        currentUser = result;
        localStorage.setItem("authToken", authToken);
        updateAuthUI();
        fetchActivities();
        showMessage("Logged in successfully.", "success", authStatus);
      } else {
        showMessage(result.detail || "Login failed.", "error", authStatus);
      }
    } catch (error) {
      showMessage("Login request failed. Please try again.", "error", authStatus);
      console.error("Error logging in:", error);
    }
  });

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(activity)}/signup?email=${encodeURIComponent(email)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        showMessage(result.message, "success", messageDiv);
        signupForm.reset();
        fetchActivities();
      } else {
        showMessage(result.detail || "An error occurred", "error", messageDiv);
      }
    } catch (error) {
      showMessage("Failed to sign up. Please try again.", "error", messageDiv);
      console.error("Error signing up:", error);
    }
  });

  refreshAuthState();
  fetchActivities();
});
