'use strict';

function LuccaLunch() {
    this.checkSetup();

    /* DOM Elements */
    // Header
    this.userPic = document.getElementById('user-pic');
    this.userName = document.getElementById('user-name');
    this.signInButton = document.getElementById('sign-in');
    this.signOutButton = document.getElementById('sign-out');
    // Main
    this.showCreateLunchDialogButton = document.getElementById('show-create-lunch');
    this.lunchsListDiv = document.getElementById('lunchs-list');
    // Dialog
    this.createLunchDialogDiv = document.querySelector('dialog');
    this.createLunchButton = document.getElementById('create-lunch');
    this.createLunchPlaceInput = document.getElementById('create-lunch-place');
    this.createLunchCommentInput = document.getElementById('create-lunch-comment');
    // Snackbar
    this.snackbarDiv = document.getElementById('snackbar');

    // Event bindings
    this.signOutButton.addEventListener('click', this.signOut.bind(this));
    this.signInButton.addEventListener('click', this.signIn.bind(this));
    this.showCreateLunchDialogButton.addEventListener('click', this.showCreateLunchDialog.bind(this));
    this.createLunchButton.addEventListener('click', this.createLunch.bind(this));

    // Dialog Init
    if (!this.createLunchDialogDiv.showModal) {
        dialogPolyfill.registerDialog(this.createLunchDialogDiv);
    }
    this.createLunchDialogDiv.querySelector('.close').addEventListener('click', this.hideCreateLunchDialog.bind(this));

    this.initFirebase();
}

// Sets up shortcuts to Firebase features and initiate firebase auth.
LuccaLunch.prototype.initFirebase = function () {
    // Shortcuts to Firebase SDK features.
    this.auth = firebase.auth();
    this.database = firebase.database();
    // Initiates Firebase auth and listen to auth state changes.
    this.auth.onAuthStateChanged(this.onAuthStateChanged.bind(this));
};

LuccaLunch.prototype.signIn = function () {
    // Sign in Firebase using popup auth and Google as the identity provider.
    var provider = new firebase.auth.GoogleAuthProvider();
    this.auth.signInWithPopup(provider);
};

LuccaLunch.prototype.signOut = function () {
    // Sign out of Firebase.
    this.auth.signOut();
};

// Triggers when the auth state change for instance when the user signs-in or signs-out.
LuccaLunch.prototype.onAuthStateChanged = function (user) {
    if (user) { // User is signed in!
        // Get profile pic and user's name from the Firebase user object.
        var profilePicUrl = user.photoURL;
        var userName = user.displayName;

        // Set the user's profile pic and name.
        this.userPic.style.backgroundImage = 'url(' + (profilePicUrl || '/images/profile_placeholder.png') + ')';
        this.userName.textContent = userName;

        // Show user's profile and sign-out button.
        this.userName.removeAttribute('hidden');
        this.userPic.removeAttribute('hidden');
        this.signOutButton.removeAttribute('hidden');

        // Hide sign-in button.
        this.signInButton.setAttribute('hidden', 'true');

        this.showLunchs();
    } else { // User is signed out!
        // Hide user's profile and sign-out button.
        this.userName.setAttribute('hidden', 'true');
        this.userPic.setAttribute('hidden', 'true');
        this.signOutButton.setAttribute('hidden', 'true');

        // Show sign-in button.
        this.signInButton.removeAttribute('hidden');

        this.hideLunchs();
    }
};

LuccaLunch.prototype.createLunch = function () {
    if(!this.createLunchPlaceInput.value) {
        this.showMessageToUser('Le champs ne peut être vide.');
        return ;
    }
    this.database.ref('lunchs/').push({
        date: Date.now(),
        place: this.createLunchPlaceInput.value,
        comment: this.createLunchCommentInput.value
    });
    this.hideCreateLunchDialog();
};

LuccaLunch.prototype.showLunchs = function () {
    this.lunchsRef = this.database.ref('lunchs/');
    this.lunchsRef.off();

    var showLunch = function (data) {
        this.displayLunch(data);
    }.bind(this);
    this.lunchsRef.on('child_added', showLunch);
    this.lunchsRef.on('child_changed', showLunch);
};

LuccaLunch.prototype.hideLunchs = function () {
    this.lunchsListDiv.innerHTML = '';
};

LuccaLunch.prototype.addUserToLunch = function(lunchKey, uid) {
    this.database.ref('lunchs/' + lunchKey + '/users/' + uid).set(true);
    // Remove this user from the others lunchs
    this.database.ref('lunchs/').once('value', function (lunchs) {
        lunchs.forEach(function (lunch) {
            if(lunch.key != lunchKey) {
                window.luccalunch.removeUserFromLunch(lunch.key, uid);
            }
        });
    });
};

LuccaLunch.prototype.removeUserFromLunch = function(lunchKey, uid) {
    this.database.ref('lunchs/' + lunchKey + '/users/' + uid).remove();
};

LuccaLunch.prototype.displayLunch = function(data) {
    var div = document.getElementById(data.key);
    var val = data.val();
    if(!div) {
        var container = document.createElement('div');
        container.innerHTML = TEMPLATE;
        div = container.firstChild;
        div.setAttribute('id', data.key);
        this.lunchsListDiv.appendChild(div);
    }
    div.querySelector('.mdl-card__title-text').textContent = val.place;
    div.querySelector('.mdl-card__supporting-text').textContent = val.comment;
    div.querySelector('.add-user').addEventListener('click', this.addUserToLunch.bind(this, data.key, this.auth.currentUser.uid));
    div.querySelector('.remove-user').addEventListener('click', this.removeUserFromLunch.bind(this, data.key, this.auth.currentUser.uid));
    div.querySelector('.user-count').setAttribute('data-badge', val.users ? Object.keys(val.users).length : 0);
};

var TEMPLATE =
    '<div class="mdl-card mdl-shadow--2dp lunch-card">' +
        '<div class="mdl-card__title">' +
            '<h2 class="mdl-card__title-text"></h2>' +
        '</div>' +
        '<div class="mdl-card__supporting-text"></div>' +
        '<div class="mdl-card__actions mdl-card--border">' +
            '<a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect add-user">OK</a>' +
            '<a class="mdl-button mdl-button--colored mdl-js-button mdl-js-ripple-effect remove-user">Actually no</a>' +
        '</div>' +
        '<div class="mdl-card__menu">' +
            '<div class="material-icons mdl-badge mdl-badge--overlap user-count" data-badge="1">account_box</div>' +
        '</div>' +
    '</div>';

// Returns true if user is signed-in. Otherwise false and displays a message.
LuccaLunch.prototype.checkSignedInWithMessage = function () {
    // Return true if the user is signed in Firebase
    if (this.auth.currentUser) {
        return true;
    }

    this.showMessageToUser('You must sign-in first');
};

LuccaLunch.prototype.showMessageToUser = function (message) {
    var data = {
        message: message,
        timeout: 2000
    };
    this.snackbarDiv.MaterialSnackbar.showSnackbar(data);
    return false;
};


// Checks that the Firebase SDK has been correctly setup and configured.
LuccaLunch.prototype.checkSetup = function () {
    if (!window.firebase || !(firebase.app instanceof Function) || !window.config) {
        window.alert('You have not configured and imported the Firebase SDK. ' +
            'Make sure you go through the codelab setup instructions.');
    } else if (config.storageBucket === '') {
        window.alert('Your Firebase Storage bucket has not been enabled. Sorry about that. This is ' +
            'actually a Firebase bug that occurs rarely. ' +
            'Please go and re-generate the Firebase initialisation snippet (step 4 of the codelab) ' +
            'and make sure the storageBucket attribute is not empty. ' +
            'You may also need to visit the Storage tab and paste the name of your bucket which is ' +
            'displayed there.');
    }
};

LuccaLunch.prototype.showCreateLunchDialog = function () {
    if(this.checkSignedInWithMessage()) {
        this.createLunchDialogDiv.showModal();
    }
};

LuccaLunch.prototype.hideCreateLunchDialog = function () {
    this.createLunchPlaceInput.value = '';
    this.createLunchPlaceInput.parentNode.MaterialTextfield.boundUpdateClassesHandler();
    this.createLunchCommentInput.value = '';
    this.createLunchCommentInput.parentNode.MaterialTextfield.boundUpdateClassesHandler();
    this.createLunchDialogDiv.close();
};

window.onload = function () {
    window.luccalunch = new LuccaLunch();
};