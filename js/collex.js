const ArcLoginEvent = new Event("arcLogin")
const ArcLogoutEvent = new Event("arcLogout")
const ArtifactStates = {
    MetadataRendered: Symbol("metadatarendered"),
    UserdataRendered: Symbol("userdatarendered")
}

class ArcUser {
    constructor(corpora_host, corpora_token, arc_user_token, wp_admin_url, arc_corpus_id, arc_federation_id) {
        this.host = corpora_host
        this.token = corpora_token
        this.arc_user_token = arc_user_token
        this.admin_url = wp_admin_url
        this.corpus_id = arc_corpus_id
        this.federation_id = arc_federation_id
        this.userid = null
        this.username = null
        this.fullname = null
        this.email = null
        this.institution = null
        this.link = null
        this.about = null
        this.my_items_modal = null

        // various shared caches and utility variables
        this.invalid_thumbs = {}
        this.federation_thumbnail = ''
        this.archives = {}
        this.agent_role_regex = new RegExp(`(\\([^\\)]*\\))$`)
        this.role_mapping = {
            'ART': 'Visual Artist',
            'AUT': 'Author',
            'EDT': 'Editor',
            'PBL': 'Publisher',
            'TRL': 'Translator',
            'CRE': 'Creator',
            'ETR': 'Etcher',
            'EGR': 'Engraver',
            'OWN': 'Owner',
            'ARC': 'Architect',
            'BND': 'Binder',
            'BKD': 'Book designer',
            'BKP': 'Book producer',
            'CLL': 'Calligrapher',
            'CTG': 'Cartographer',
            'COL': 'Collector',
            'CLR': 'Colorist',
            'CWT': 'Commentator',
            'COM': 'Compiler',
            'CMT': 'Compositor',
            'DUB': 'Dubious author',
            'FAC': 'Facsimilist',
            'ILU': 'Illuminator',
            'ILL': 'Illustrator',
            'LTG': 'Lithographer',
            'PRT': 'Printer',
            'POP': 'Printer of plates',
            'PRM': 'Printmaker',
            'RPS': 'Repository',
            'RBR': 'Rubricator',
            'SCR': 'Scribe',
            'SCL': 'Sculptor',
            'TYD': 'Type designer',
            'TYG': 'Typographer',
            'WDE': 'Wood engraver',
            'WDC': 'Wood cutter'
        }
        this.results_populated = {}

        this.auth_box = jQuery('#arc-user-auth-box')
        this.auth_box.css("display", "flex")
        let sender = this

        // SETUP LOGIN FUNCTIONALITY
        if (this.auth_box.length) {
            this.auth_box.append(`
                <div id="arc-user-greeting" style="display: none;"></div>
                <details id="arc-login-box">
                    <summary>Login</summary>
                    <div>
                        <div id="arc-login-form-message" class="form-alert-message" style="display: none;"></div>
                        <input type="text" id="arc-user-name-box" class="arc-user-auth-control" aria-label="Username" placeholder="Username" /><br />
                        <input type="password" id="arc-user-pwd-box" class="arc-user-auth-control" aria-label="Password" placeholder="Password" /><br />
                        <button id="arc-user-auth-button" class="arc-user-metadata-element">Login</button>
                    </div>
                </details>
                <details id="arc-register-box" style="margin-left: 20px;">
                    <summary>Register</summary>
                    <div>
                        <div id="arc-register-form-message" class="form-alert-message" style="display: none;"></div>
                        <input type="text" id="arc-newuser-name-box" class="arc-user-auth-control" aria-label="Username" placeholder="Username" /><br />
                        <input type="password" id="arc-newuser-pwd-box" class="arc-user-auth-control" aria-label="Password" placeholder="Password" /><br />
                        <input type="password" id="arc-newuser-pwd-confirm-box" class="arc-user-auth-control" aria-label="Confirm Password" placeholder="Confirm Password" /><br />
                        <input type="email" id="arc-newuser-email-box" class="arc-user-auth-control" aria-label="Email" placeholder="Email" /><br />
                        <input type="text" id="arc-newuser-fullname-box" class="arc-user-auth-control" aria-label="Full Name" placeholder="Full Name" /><br />
                        <button id="arc-newuser-register-button" class="arc-user-metadata-element">Register</button>
                    </div>
                </details>
            `)

            jQuery('#arc-user-auth-button').click(function() {
                sender.perform_login()
            })

            jQuery('.arc-user-auth-control').on('keydown', function (e) {
                if (e.keyCode === 13) sender.perform_login()
            })

            jQuery('#arc-newuser-register-button').click(function() {
                sender.perform_registration()
            })
        }

        // IF ALREADY LOGGED IN, LOAD USER INFO
        if (this.arc_user_token) this.load_user_info()

        // grab federation thumbnail
        this.make_request(
            `/api/corpus/${this.corpus_id}/ArcFederation/${this.federation_id}/`,
            'GET',
            {},
            function (fed) {
                if (fed.thumbnail) {
                    sender.federation_thumbnail = fed.thumbnail
                }
            }
        )
    }

    make_request(path, type, params={}, callback, inject_host=true) {
        if (this.arc_user_token) params['arc-user-token'] = this.arc_user_token

        let url = path
        if (inject_host) url = `${this.host}${path}`

        let req = {
            type: type,
            url: url,
            dataType: 'json',
            crossDomain: true,
            data: params,
            success: callback
        }

        if (this.token) {
            let sender = this
            req['beforeSend'] = function (xhr) {
                xhr.setRequestHeader("Authorization", `Token ${sender.token}`)
            }
        }

        return jQuery.ajax(req)
    }

    perform_login() {
        let user_name_box = jQuery('#arc-user-name-box')
        let user_pwd_box = jQuery('#arc-user-pwd-box')
        let sender = this

        sender.make_request(
            `/api/arc/user-auth/${sender.corpus_id}/${user_name_box.val()}/`,
            'POST',
            {'password': user_pwd_box.val()},
            function(data) {
                let msg_div = jQuery('#arc-login-form-message')

                if (('user_auth_token' in data) && data.user_auth_token) {
                    sender.arc_user_token = data.user_auth_token
                    sender.make_request(
                        sender.admin_url,
                        'POST',
                        {
                            'action': 'arc_user_login',
                            'arc_user_auth_token': data.user_auth_token
                        },
                        function() {
                            console.log('cookie stored.')
                            user_name_box.val('')
                            user_pwd_box.val('')
                            sender.load_user_info()
                            msg_div.hide()
                        },
                        false
                    )
                } else {
                    msg_div.html(`Invalid username or password.`)
                    msg_div.show()
                }
            }
        )
    }

    perform_registration() {
        let user_name_box = jQuery('#arc-newuser-name-box')
        let user_pwd_box = jQuery('#arc-newuser-pwd-box')
        let user_pwd_box2 = jQuery('#arc-newuser-pwd-confirm-box')
        let user_email_box = jQuery('#arc-newuser-email-box')
        let user_fullname_box = jQuery('#arc-newuser-fullname-box')
        let msg_div = jQuery('#arc-register-form-message')
        let password_validator = /^(?=.*[0-9])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{7,30}$/
        let email_validator = /^\S+@\S+\.\S+$/
        let validated = true
        let sender = this

        msg_div.empty()
        if (user_pwd_box.val().trim() !== user_pwd_box2.val().trim()) {
            validated = false
            msg_div.append('Passwords do not match!')
        }

        if (!user_pwd_box.val().trim().match(password_validator)) {
            validated = false
            msg_div.append(' Password must be at least 7 characters long, must contain at least one numeric digit and one special character.')
        }

        if (!email_validator.test(user_email_box.val().trim())) {
            validated = false
            msg_div.append(' Please use a valid email address.')
        }

        if (! (user_name_box.val().length && user_pwd_box.val().length && user_email_box.val().length && user_fullname_box.val().length)) {
            validated = false
            msg_div.append(' Please fill out all fields.')
        }

        if (validated) {
            sender.make_request(
                `/api/arc/user-auth/${sender.corpus_id}/${user_name_box.val()}/`,
                'POST',
                {
                    'register': 'y',
                    'password': user_pwd_box.val().trim(),
                    'email': user_email_box.val().trim(),
                    'fullname': user_fullname_box.val().trim(),
                },
                function(data) {
                    if (('user_auth_token' in data) && data.user_auth_token) {
                        sender.arc_user_token = data.user_auth_token
                        sender.make_request(
                            sender.admin_url,
                            'POST',
                            {
                                'action': 'arc_user_login',
                                'arc_user_auth_token': data.user_auth_token
                            },
                            function() {
                                console.log('cookie stored.')
                                user_name_box.val('')
                                user_pwd_box.val('')
                                user_pwd_box2.val('')
                                user_email_box.val('')
                                user_fullname_box.val('')
                                sender.load_user_info()
                                msg_div.hide()
                            },
                            false
                        )
                    } else {
                        msg_div.html(data.message)
                        msg_div.show()
                    }
                }
            )
        } else msg_div.show()
    }

    load_user_info() {
        if (this.arc_user_token) {
            let sender = this
            sender.make_request(
                `/api/arc/user-info/${sender.corpus_id}/`,
                'GET',
                {},
                function(data) {
                    if (('message' in data) && data.message === 'basic info retrieved') {
                        if (('info' in data) && data.info) {
                            sender.userid = data.info.userid
                            sender.username = data.info.username
                            sender.fullname = data.info.fullname
                            sender.email = data.info.email
                            sender.institution = data.info.institution
                            sender.link = data.info.link
                            sender.about = data.info.about

                            let login_box = jQuery('#arc-login-box')
                            let register_box = jQuery('#arc-register-box')
                            let greeting_div = jQuery('#arc-user-greeting')

                            login_box.hide()
                            register_box.hide()
                            greeting_div.show()
                            greeting_div.html(`
                                <a id="arc-user-my-items-link" href="#">My Collection</a> | <a id="arc-logout-link" href="#">Logout</a>
                            `)

                            // setup collection modal
                            jQuery('body').append(`
                                <div id="arc-user-my-items-modal" title="My Collected Items" style="max-height: .8vh; overflow-y: scroll;">
                                    No items have been collected yet.
                                </div>
                            `)

                            sender.my_items_modal = jQuery('#arc-user-my-items-modal')
                            let my_items_link = jQuery('#arc-user-my-items-link')

                            sender.my_items_modal.dialog({
                                autoOpen: false,
                                modal: true,
                                width: 700,
                                height: parseInt(jQuery(window).height() *0.8),
                                position: {
                                    my: 'center',
                                    at: 'center',
                                    of: window
                                }
                            })

                            my_items_link.click(function() {
                                sender.make_request(
                                    `/api/arc/user-collection/${sender.corpus_id}/`,
                                    'GET',
                                    {'page-size': 1000},
                                    function(my_items) {
                                        console.log(my_items)
                                        if (my_items.collection && my_items.collection.records && my_items.collection.records.length) {
                                            sender.my_items_modal.empty()

                                            my_items.collection.records.forEach(item => {
                                                let uri = item.artifact_uri
                                                sender.make_request(
                                                    `/api/corpus/${sender.corpus_id}/ArcArtifact/`,
                                                    'GET',
                                                    {'f_external_uri': uri, 'page-size': 1},
                                                    function(item_lookup) {
                                                        if (item_lookup.records && item_lookup.records.length === 1) {
                                                            let art = item_lookup.records[0]
                                                            sender.my_items_modal.append(`
                                                                <table id="my-${art.id}-container" class="arc-search-result" data-id="${art.id}">
                                                                    <tr>
                                                                        <td id="my-${art.id}-thumb-container" class="arc-search-result-thumb-container">
                                                                            <img id="my-${art.id}-thumb" class="arc-search-result-thumb" src="" data-src="" />
                                                                        </td>
                                                                        <td className="arc-search-result-details-container">
                                                                            <a id="my-${art.id}-title" href="#" target="_blank" className="arc-search-result-title"></a>
                                                                            <dl id="my-${art.id}-metadata" style="width: inherit; display: grid; grid-template-columns: 15% 85%;">
                                                                            </dl>
                                                                        </td>
                                                                    </tr>
                                                                </table>
                                                            `)
                                                            console.log(art)
                                                            sender.results_populated[`my-${art.id}`] = ArtifactStates.MetadataRendered
                                                            sender.render_artifact(`my-${art.id}`, art)
                                                        }
                                                    }
                                                )
                                            })
                                        } else {
                                            sender.my_items_modal.html('No items have been collected yet.')
                                        }

                                        sender.my_items_modal.dialog('open')
                                    }
                                )
                            })

                            jQuery('#arc-logout-link').click(function() {
                                sender.make_request(
                                    sender.admin_url,
                                    'POST',
                                    {
                                        'action': 'arc_user_login',
                                        'arc_user_logout': 'y'
                                    },
                                    function(data) {
                                        console.log(data)
                                        sender.make_request(
                                            `/api/arc/user-auth/${sender.corpus_id}/${sender.username}/`,
                                            'GET',
                                            {'logout': 'y'},
                                            function(data) {
                                                console.log(data)
                                                sender.user_auth_token = null
                                                sender.userid = null
                                                sender.username = null
                                                sender.fullname = null
                                                sender.email = null
                                                sender.institution = null
                                                sender.link = null
                                                sender.about = null
                                                sender.my_items_modal.remove()
                                                sender.my_items_modal = null
                                                greeting_div.hide()
                                                login_box.show()
                                                register_box.show()
                                                document.dispatchEvent(ArcLogoutEvent)
                                            },
                                        )
                                    },
                                    false
                                )
                            })

                            document.dispatchEvent(ArcLoginEvent)
                        }
                    }
                }
            )
        }
    }

    // shared utility functions
    render_artifact(artifact_id, metadata) {
        let sender = this
        let meta_table = jQuery(`#${artifact_id}-container`)
        meta_table.data('uri', metadata.external_uri)

        // title and thumbnail
        let title = sender.htmlDecode(metadata.title)
        title = sender.truncate(title, 100) // mv truncate to user
        let thumb = metadata.thumbnail_url
        let title_link = jQuery(`#${artifact_id}-title`)
        title_link.html(title)
        title_link.attr('href', metadata.url)
        let img = jQuery(`#${artifact_id}-thumb`)
        img.attr('alt', title.replaceAll('"', ''))
        if (thumb) sender.show_thumbnail(artifact_id, thumb) // mv show_thumbnail to user

        let meta_div = jQuery(`#${artifact_id}-metadata`)

        // agents
        let agents = {}
        metadata.agents.map(a => {
            let [agent_name, role] = sender.parse_agent_string(a.label) // mv parse_agent_string to user
            if (role in sender.role_mapping) { // mv role_mapping to user
                if (!(role in agents)) agents[role] = []
                agents[role].push({name: sender.htmlDecode(agent_name), id: a.id})
            }
        })

        Object.keys(agents).sort().map(role => {
            let role_label = sender.role_mapping[role]
            if (agents[role].length > 1) role_label += 's'
            let people_links = []
            let current_url = window.location.origin + window.location.pathname
            agents[role].map(person => {
                people_links.push(`
                    <a href="${current_url}?agent=${person.id}" target="_blank">${person.name}</a>
                `)
            })
            meta_div.append(`
                <dt>${role_label}:</dt><dd>${people_links.join('; ')}</dd>
            `)
        })

        // archive
        this.get_archive_data(metadata.archive.id, function(arch_meta) {
            meta_div.append(`
                <dt>Site:</dt>
                <dd class="arc-archive-link-${arch_meta.id}">
                    <a href="${arch_meta.site_url}" target="_blank">
                        ${arch_meta.name}
                    </a>
                </dd>
            `)
            if (!thumb) {
                thumb = arch_meta.thumbnail
                if (thumb) {
                    sender.show_thumbnail(artifact_id, thumb)
                } else sender.show_thumbnail(artifact_id, sender.federation_thumbnail)
            }
        })

        // genre
        let genre_string = ''
        metadata.genres.map(g => {
            if (genre_string) genre_string += ', '
            genre_string += g.label
        })
        meta_div.append(`<dt>Genre(s):</dt><dd>${genre_string}</dd>`)

        // discipline
        let disc_string = ''
        metadata.disciplines.map(d => {
            if (disc_string) disc_string += ', '
            disc_string += d.label
        })
        meta_div.append(`<dt>Discipline(s):</dt><dd>${disc_string}</dd>`)

        // date
        meta_div.append(`<dt>Date:</dt><dd>${metadata.date_label}</dd>`)

        // user collection info
        sender.inject_user_metadata(artifact_id)
    }

    inject_user_metadata(result_id) {
        let sender = this
        if (sender.userid && (result_id in sender.results_populated) && sender.results_populated[result_id] === ArtifactStates.MetadataRendered) {
            let result_container = jQuery(`#${result_id}-container`)
            let result_uri = result_container.data('uri')
            if (result_uri) {
                sender.results_populated[result_id] = ArtifactStates.UserdataRendered
                jQuery(`#${result_id}-thumb-container`).append(`
                    <button id="${result_id}-collect-button"
                        type="button" class="arc-user-metadata-element"
                        title="Click to collect and annotate this item!"
                        onClick="collex.collect_result('${result_id}');"
                    >Collect</button>
                `)

                let col_button = jQuery(`#${result_id}-collect-button`)
                let metadata = jQuery(`#${result_id}-metadata`)

                sender.make_request(
                    `/api/corpus/${sender.corpus_id}/ArcCollection/`,
                    "GET",
                    {
                        'f_arc_userid': sender.userid,
                        'f_artifact_uri': result_uri,
                        'only': 'annotation'
                    },
                    function (col) {
                        if (col.hasOwnProperty('records') && col.records.length) {
                            col = col.records[0]
                            col_button.html('Uncollect')
                            result_container.data('is_collected', 'true')

                            if (col.hasOwnProperty('annotation') && col.annotation) {
                                metadata.append(`<dt class="arc-user-metadata-element">Annotation:</dt><dd class="arc-user-metadata-element">${col.annotation}</dd>`)
                            }
                        }
                    }
                )
            }
        }
    }

    truncate(str, n){
        return (str.length > n) ? str.substr(0, n-1) + '&hellip;' : str
    }

    htmlDecode(str) {
        return jQuery.parseHTML(str)[0].textContent
    }

    show_thumbnail(result_id, src) {
        let sender = this
        let thumbnail = jQuery(`#${result_id}-thumb`)

        if (src.startsWith('http:')) src = src.replace('http:', 'https:')
        thumbnail.attr('data-src', src)

        if (!(src in sender.invalid_thumbs)) {
            thumbnail.on('error', function () {
                thumbnail.off('error')
                thumbnail.attr('src', sender.federation_thumbnail)
                sender.invalid_thumbs[src] = true
            })
            thumbnail.attr('src', src)
        } else thumbnail.attr('src', sender.federation_thumbnail)
    }

    parse_agent_string(agent) {
        let name = ''
        let role = ''
        let role_match = agent.match(this.agent_role_regex)
        if (role_match !== null) {
            let role_string = role_match[0]
            name = agent.replace(role_string, '').trim()
            role = role_string.replace('(', '').replace(')', '')
        } else
            name = agent

        return [name, role]
    }

    get_archive_data(archive_id, callback) {
        if (archive_id in this.archives) callback(this.archives[archive_id])
        else {
            let sender = this
            this.make_request(
                `/api/corpus/${this.corpus_id}/ArcArchive/${archive_id}/`,
                'GET',
                {},
                function (archive) {
                    sender.archives[archive_id] = archive
                    callback(archive)
                }
            )
        }
    }
}

class ArcQuickSearch {}

class ArcFullSearch {

    //constructor(corpora_host, arc_corpus_id, arc_federation_id, arc_other_federation_ids) {
    constructor(arc_user, arc_other_federation_ids) {
        //this.host = corpora_host
        //this.corpus_id = arc_corpus_id
        //this.federation_id = arc_federation_id
        this.user = arc_user
        this.federation_handle = null
        this.search_params = {
            't_federations.id': this.user.federation_id
        }

        this.search_box = jQuery('#arc-fs-search-box')
        this.facets_box = jQuery('#arc-fs-facets-box')
        this.results_box = jQuery('#arc-fs-results-box')
        this.help_box = jQuery('#arc-fs-help-box')

        this.query_box = null
        this.query_box_autocomplete = null
        this.last_autocomplete_request = null
        this.autocomplete_selected = false
        this.autocollapse_refinements = false
        this.refinements_box = null

        this.feds_widget = null
        this.arch_widget = null
        this.form_widget = null
        this.disc_widget = null
        this.genr_widget = null

        this.year_slider = null
        this.year_indicator = null
        this.slider_timer = null

        this.title_box = null
        this.person_box = null
        this.role_box = null

        this.results_observer = null
        this.results_scrolled = 0
        this.page_observer = null

        // parse URL GET params
        this.url_params = new URLSearchParams(window.location.search)

        let sender = this

        // SEARCH BOX SETUP
        if (this.search_box.length) {
            // add query_box input and advanced search controls
            this.search_box.append(`
                <input type="text" id="arc-fs-query-box" />
                <div id="arc-fs-param-box"></div>
                <details id="arc-fs-refine-box">
                    <summary>Refine Search</summary>
                    <div id="arc-fs-refinements-grid">
                        <div class="search-refinement">
                            <h4 class="search-refinement-header">Works</h4>
                            <label for="arc-fs-title-box">Title</label>
                            <input id="arc-fs-title-box" type="text" placeholder="Title">
                        </div>
                        
                        <div class="search-refinement">
                            <h4 class="search-refinement-header">People</h4>
                            <label for="arc-fs-person-name-box">Name</label>
                            <input id="arc-fs-person-name-box" type="text" placeholder="Name">
                            <label for="arc-fs-person-role-box">Role</label>
                            <select id="arc-fs-person-role-box"></select>
                        </div>
                    
                        <div class="search-refinement search-refinement-full">
                            <h4 class="search-refinement-header">Time</h4>
                            <label class="label-inline" for="arc-fs-year-range-indicator">Date Range:</label>
                            <input type="text" id="arc-fs-year-range-indicator" class="input-inline" readonly>
                            <div id="arc-fs-year-range-slider"></div>
                        </div>
                    </div>
                </details>
            `)

            // link up search-related element variables
            this.refinements_box = jQuery('#arc-fs-refine-box')
            this.title_box = jQuery('#arc-fs-title-box')
            this.year_slider = jQuery('#arc-fs-year-range-slider')
            this.year_indicator = jQuery('#arc-fs-year-range-indicator')
            this.person_box = jQuery('#arc-fs-person-name-box')
            this.role_box = jQuery('#arc-fs-person-role-box')
            this.param_box = jQuery('#arc-fs-param-box')
            this.param_box.hide()

            // rig up query_box search event
            this.query_box = jQuery('#arc-fs-query-box')
            this.query_box.keyup(function(e) {
                if (sender.autocomplete_selected) sender.autocomplete_selected = false
                else if (e.key === "Enter") {
                    console.log('enter event fired')
                    sender.search_params['q'] = sender.query_box.val()
                    sender.populate_results()
                }
            })

            // rig up autocomplete for query_box
            this.query_box_autocomplete = new autoComplete({
                selector: '#arc-fs-query-box',
                data: {
                    src: async (query) => {
                        const current_autocomplete_request = (new Date()).getTime()
                        let fed_filter = ''
                        if ('t_federations.id' in sender.search_params) fed_filter = `&f_federations.id=${sender.search_params['t_federations.id']}`
                        const request = await fetch(`${sender.user.host}/api/corpus/${sender.user.corpus_id}/ArcArtifact/suggest/?q=${query}${fed_filter}`)
                        const suggestions = await request.json()
                        if (current_autocomplete_request < sender.last_autocomplete_request) throw Error("Stale autocomplete response")
                        sender.last_autocomplete_request = current_autocomplete_request

                        let data = []
                        Object.keys(suggestions).map(field => {
                           suggestions[field].map(suggestion => data.push({suggestion: suggestion, field: field}))
                        })
                        return data
                    },
                    keys: ['suggestion'],
                },
                threshold: 2,
                resultsList: {
                    maxResults: 10
                },
                resultItem: {
                    element: (item, data) => {
                        let item_label = data.match
                        let field_label = data.value.field

                        if (field_label === 'agents') {
                            let [name, role] = sender.user.parse_agent_string(item_label)
                            if (role in sender.user.role_mapping)
                                role = sender.user.role_mapping[role]
                            item_label = `${name} (${role})`
                            field_label = 'PERSON'
                        }

                        item.style = "display: flex; justify-content: space-between;"
                        item.innerHTML = `
                            <span style="text-overflow: ellipsis; white-space: nowrap; overflow: hidden;">${item_label}</span>
                            <span style="display: flex; align-items: center; font-size: 13px; font-weight: 100; text-transform: uppercase; color: rgba(0,0,0,.5);">${field_label}</span>
                        `
                    },
                    highlight: true
                },
                searchEngine: (query, record) => {
                    let mark_start = record.toLowerCase().indexOf(query.toLowerCase())
                    if (mark_start > -1) {
                        return record.slice(0, mark_start) + '<mark>' + record.slice(mark_start, query.length + mark_start) + '</mark>' + record.slice(query.length + mark_start, record.length)
                    } else return record
                },
                events: {
                    input: {
                        focus: () => {
                            if (sender.query_box.val().length) sender.query_box_autocomplete.start()
                        }
                    }
                }
            })

            // handle autocomplete selection event
            this.query_box[0].addEventListener('selection', function(event) {
                sender.autocomplete_selected = true
                let suggestion = event.detail.selection.value.suggestion
                let suggestion_field = event.detail.selection.value.field

                if (suggestion_field === 'title') {
                    sender.title_box.val(suggestion)
                    sender.search_params[`q_${suggestion_field}`] = suggestion
                } else if (suggestion_field === 'agents') {
                    let [name, role] = sender.user.parse_agent_string(suggestion)
                    sender.person_box.val(name)
                    sender.role_box.val(role)
                    sender.search_params[`f_${suggestion_field}.label.raw`] = suggestion
                }

                sender.query_box.val('')
                sender.refinements_box.prop('open', true)
                sender.autocollapse_refinements = true
                sender.populate_results()
            })

            // rig up time slider
            let slider_delay_seconds = 3
            sender.year_slider.slider({
                range: true,
                slide: function(event, ui) {
                    sender.year_indicator.val(`${ui.values[0]} - ${ui.values[1]}`)
                },
                start: function(event, ui) {
                    clearTimeout(sender.slider_timer)
                },
                stop: function(event, ui) {
                    clearTimeout(sender.slider_timer)
                    sender.slider_timer = setTimeout(sender.refine_by_date_range.bind(sender), slider_delay_seconds * 1000)
                }
            })
            sender.configure_year_slider()

            // populate person roles and rig up events
            Object.keys(this.user.role_mapping).map(role => {
                this.role_box.append(`
                    <option value="${role}">${this.user.role_mapping[role]}</option>
                `)
            })
            this.role_box.val('AUT')
            this.person_box.keyup(function(e) {
                if (e.key === "Enter") {
                    sender.user.make_request(
                        `/api/corpus/${sender.user.corpus_id}/ArcAgent/`,
                        "GET",
                        {
                            'q_entity.name': sender.person_box.val(),
                            'f_role.name': sender.role_box.val()
                        },
                        function(data) {
                            if (data.hasOwnProperty('records')) {
                                let agent_ids = []
                                for (let rec_index = 0; rec_index < data.records.length; rec_index++) {
                                    if (agent_ids.length < 50) {
                                        agent_ids.push(data.records[rec_index].id)
                                    } else break
                                }
                                if (agent_ids.length) {
                                    sender.search_params['t_agents.id'] = agent_ids.join('__')
                                    sender.populate_results()
                                }
                            }
                        }
                    )
                }
            })
        }

        // RESULTS BOX SETUP
        if (this.results_box.length) {
            // No setup needed for now.
        }

        if (this.facets_box.length) {

            // FEDERATION BOX SETUP
            if (!jQuery('#arc-fs-feds-widget').length) {
                this.facets_box.append(`
                    <h3 class="arc-fs-facet-header">Federations</h3>
                    <div id="arc-fs-feds-widget" class="arc-fs-facet-widget"></div>
                `)
                this.feds_widget = jQuery('#arc-fs-feds-widget')
            }

            // ARCHIVES TREE SETUP
            if (!jQuery('#arc-fs-arch-widget').length) {
                this.facets_box.append(`
                    <h3 class="arc-fs-facet-header">Archives</h3>
                    <div id="arc-fs-arch-widget" class="arc-fs-facet-widget"></div>
                `)
                this.arch_widget = jQuery('#arc-fs-arch-widget')
            }

            // FORMAT FACETS SETUP
            if (!jQuery('#arc-fs-form-widget').length) {
                sender.facets_box.append(`
                    <h3 class="arc-fs-facet-header">Formats</h3>
                    <div id="arc-fs-form-widget" class="arc-fs-facet-widget"></div>
                `)
                sender.form_widget = jQuery('#arc-fs-form-widget')
            }

            // DISCIPLINE FACETS SETUP
            if (!jQuery('#arc-fs-disc-widget').length) {
                sender.facets_box.append(`
                    <h3 class="arc-fs-facet-header">Disciplines</h3>
                    <div id="arc-fs-disc-widget" class="arc-fs-facet-widget"></div>
                `)
                sender.disc_widget = jQuery('#arc-fs-disc-widget')
            }

            // GENRE FACETS SETUP
            if (!jQuery('#arc-fs-genr-widget').length) {
                sender.facets_box.append(`
                    <h3 class="arc-fs-facet-header">Genres</h3>
                    <div id="arc-fs-genr-widget" class="arc-fs-facet-widget"></div>
                `)
                sender.genr_widget = jQuery('#arc-fs-genr-widget')
            }

            jQuery.when(
                // build federation elements
                sender.user.make_request(
                    `/api/corpus/${sender.user.corpus_id}/ArcFederation/`,
                    "GET",
                    {},
                    function(data) {
                        let feds_allowed = [ sender.user.federation_id ]
                        feds_allowed = feds_allowed.concat(arc_other_federation_ids.split(','))
                        if (data.hasOwnProperty('records')) {
                            feds_allowed.map(fed_id => {
                                data.records.map(fed => {
                                    if (fed.id === fed_id) {
                                        let checked = false
                                        if (fed_id === sender.user.federation_id) {
                                            checked = true
                                            sender.federation_handle = fed.handle
                                            sender.query_box.attr('placeholder', `Search ${sender.federation_handle}`)
                                        }

                                        sender.feds_widget.append(`
                                            <div id="federation-facet-${fed.id}" class="federation-facet arc-facet">
                                                <span class="facet-label">
                                                    <input id="federation-facet-${fed.id}-checkbox"
                                                        class="arc-fs-fed-checkbox"
                                                        type="checkbox"
                                                        data-id="${fed.id}"
                                                        data-thumbnail="${fed.thumbnail}"
                                                        ${checked ? 'checked': ''}>
                                                        
                                                        <img src="${fed.thumbnail}" alt="${fed.handle}" style="vertical-align: middle;" />
                                                </span>
                                                <span id="federation-facet-${fed.id}-count" class="facet-count"></span>
                                            </div>
                                        `)
                                    }
                                })
                            })

                            let fed_checks = jQuery('.arc-fs-fed-checkbox')
                            fed_checks.change(function() {
                                let feds_selected = []
                                fed_checks.each(function() {
                                   if (this.checked) feds_selected.push(jQuery(this).data('id'))
                                })
                                sender.search_params['t_federations.id'] = feds_selected.join('__')
                                sender.populate_results()
                            })
                        }
                    }
                ),
                // build archive elements
                sender.user.make_request(
                    `/api/corpus/${sender.user.corpus_id}/ArcArchive/`,
                    "GET",
                    {s_parent_path: 'asc', s_name: 'asc', 'page-size': 1000},
                    function(data) {
                        if (data.hasOwnProperty('records')) {
                            data.records.map(arch => {
                                if (arch.parent_path) {
                                    let current_parent = sender.arch_widget
                                    let parents = arch.parent_path.split('__')
                                    parents.map((parent_name, depth) => {
                                        let parent_id = 'arc-fs-arch-' + parent_name.replace(/ /g, '').replace(/,/g, '')
                                        if (!jQuery(`#${parent_id}`).length) {
                                            current_parent.append(`
                                                <details id="${parent_id}" class="archive-parent" ${depth > 0 ? `data-parent="${current_parent[0].id}"` : ''}>
                                                    <summary style="margin-left: -20px;">
                                                        <span class="facet-label">${parent_name}</span>
                                                        <span id="${parent_id}-count" class="facet-count">0</span>
                                                    </summary>
                                                </details>
                                            `)
                                        }
                                        current_parent = jQuery(`#${parent_id}`)
                                    })

                                    current_parent.append(`
                                        <div id="archive-facet-${arch.id}"
                                            class="archive-facet arc-facet"
                                            data-name="${arch.name}"
                                            data-handle="${arch.handle}"
                                            data-thumbnail="${arch.thumbnail}"
                                            data-site-url="${arch.site_url}"
                                            data-parent="${current_parent[0].id}"
                                            data-parent-path="${arch.parent_path}">
                                            
                                            <span class="facet-label">${arch.name}</span>
                                            <span id="archive-facet-${arch.id}-count" class="facet-count archive-count">0</span>
                                        </div>
                                    `)

                                    jQuery(`#archive-facet-${arch.id}`).click(function() {
                                        sender.toggle_facet('t_archive.id', arch.id)
                                    })
                                }
                            })
                        }
                    }
                ),
                // build format elements
                sender.user.make_request(
                    `/api/corpus/${sender.user.corpus_id}/ArcType/`,
                    "GET",
                    {s_name: 'asc', 'page-size': 1000},
                    function(data) {
                        if (data.hasOwnProperty('records')) {
                            data.records.map(format => {
                                sender.form_widget.append(`
                                    <div id="format-facet-${format.id}" class="format-facet arc-facet" data-name="${format.name}">
                                        <span class="facet-label">${format.name}</span>
                                        <span id="format-facet-${format.id}-count" class="facet-count"></span>
                                    </div>
                                `)

                                jQuery(`#format-facet-${format.id}`).click(function() {
                                    sender.toggle_facet('t_types.id', format.id)
                                })
                            })
                        }
                    }
                ),
                // build discipline elements
                sender.user.make_request(
                    `/api/corpus/${sender.user.corpus_id}/ArcDiscipline/`,
                    "GET",
                    {s_name: 'asc', 'page-size': 1000},
                    function(data) {
                        if (data.hasOwnProperty('records')) {
                            data.records.map(disc => {
                                sender.disc_widget.append(`
                                    <div id="disc-facet-${disc.id}" class="disc-facet arc-facet" data-name="${disc.name}">
                                        <span class="facet-label">${disc.name}</span>
                                        <span id="disc-facet-${disc.id}-count" class="facet-count"></span>
                                    </div>
                                `)

                                jQuery(`#disc-facet-${disc.id}`).click(function() {
                                    sender.toggle_facet('t_disciplines.id', disc.id)
                                })
                            })
                        }
                    }
                ),
                // build genre elements
                sender.user.make_request(
                    `/api/corpus/${sender.user.corpus_id}/ArcGenre/`,
                    "GET",
                    {s_name: 'asc', 'page-size': 1000},
                    function(data) {
                        if (data.hasOwnProperty('records')) {
                            data.records.map(genre => {
                                sender.genr_widget.append(`
                                    <div id="genre-facet-${genre.id}" class="genre-facet arc-facet" data-name="${genre.name}">
                                        <span class="facet-label">${genre.name}</span>
                                        <span id="genre-facet-${genre.id}-count" class="facet-count"></span>
                                    </div>
                                `)

                                jQuery(`#genre-facet-${genre.id}`).click(function() {
                                    sender.toggle_facet('t_genres.id', genre.id)
                                })
                            })
                        }
                    }
                ),
            ).done(function() {
                // handle any search parameters passed in via URL param
                let defer_populating = false

                let q_param = sender.get_url_param('q')
                if (q_param) {
                    sender.query_box.val(q_param)
                    sender.search_params['q'] = q_param
                }

                let archive_params = sender.get_url_param('archive')
                if (archive_params) {
                    sender.search_params['t_archive.id'] = archive_params
                }

                let agent_params = sender.get_url_param('agent')
                if (agent_params) {
                    sender.search_params['t_agents.id'] = agent_params
                    defer_populating = true
                    sender.user.make_request(
                        `/api/corpus/${sender.user.corpus_id}/ArcAgent/${agent_params}/`,
                        "GET",
                        {},
                        function(data) {
                            sender.person_box.val(data.entity.label)
                            sender.role_box.val(data.role.label)
                            sender.populate_results()
                        }
                    )
                }

                if (!defer_populating) sender.populate_results()
            })
        }

        // SUBSCRIBE TO LOGIN/LOGOUT EVENTS
        document.addEventListener('arcLogin', function() {
            console.log('adding user modals...')

            // setup collection modal
            jQuery('body').append(`
                <div id="arc-user-collection-modal" title="Collect">
                    <input id="arc-user-collection-artifact-id" type="hidden" />
                    <label for="arc-user-collection-annotation">Optional Annotation:</label>
                    <textarea id="arc-user-collection-annotation"></textarea>
                    <button id="arc-user-collection-button" type="button" class="arc-user-metadata-element">Save to Collection</button>
                </div>
            `)

            let collection_modal = jQuery('#arc-user-collection-modal')
            let save_collection_button = jQuery('#arc-user-collection-button')

            collection_modal.dialog({
                autoOpen: false,
                modal: true
            })

            save_collection_button.click(function() {
                let artifact_id = jQuery('#arc-user-collection-artifact-id').val()
                let meta_div = jQuery(`#${artifact_id}-metadata`)
                let annotation = jQuery('#arc-user-collection-annotation').val()

                sender.user.make_request(
                    `/api/arc/user-collection/${sender.user.corpus_id}/`,
                    'POST',
                    {
                        'artifact-id': artifact_id,
                        'annotation': annotation
                    },
                    function(data) {
                        if (data.message && data.message === "artifact collected successfully") {
                            collection_modal.dialog('close')
                            jQuery(`#${artifact_id}-container`).data('is_collected', 'true')
                            jQuery(`#${artifact_id}-collect-button`).html('Uncollect')
                            meta_div.append(`<dt class="arc-user-metadata-element">Annotation:</dt><dd class="arc-user-metadata-element">${annotation}</dd>`)
                        }
                    }
                )
            })

            // inject any user metadata for currently visible search results
            let current_result = jQuery(`#arc-fs-current-result-count`)
            if (current_result.length) {
                current_result = current_result.html().trim()
                if (current_result && !isNaN(current_result)) {
                    current_result = parseInt(current_result)
                    current_result -= 10
                    if (current_result < 1) current_result = 1

                    for (let x = current_result; x < current_result + 20; x++) {
                        let result = jQuery(`table[data-count=${x}]`)
                        if (result.length) {
                            sender.user.inject_user_metadata(result.data('id'))
                        }
                    }
                }
            }
        })
        document.addEventListener('arcLogout', function() {
            jQuery('.arc-user-metadata-element').remove()
        })
    }

    populate_results(refresh_facets=true) {
        let sender = this

        if (refresh_facets) {
            //jQuery(`#arc-fs-refine-box`).prop('open', false)
            sender.user.results_populated = {}
            sender.results_scrolled = 0
            sender.current_meta = null
            sender.show_search_params()
        }

        let total_results = jQuery(`#arc-fs-total-result-count`)

        // QUERY
        if (sender.has_query()) {
            // hide search help box if exists
            if (sender.help_box.length) sender.help_box.hide()

            if (refresh_facets) {
                sender.results_box.empty()
                sender.search_params['page'] = 1
                sender.search_params['page-size'] = 50
                sender.search_params['only'] = 'id'
            }

            // copy search params so we can modify them for full text searching and year aggregations
            let search = Object.assign({}, sender.search_params)

            // add aggregations for min and max publication year
            if (refresh_facets) {
                search['a_max_maxyear'] = 'years'
                search['a_min_minyear'] = 'years'
            }

            // add highlights for full text search
            if (search.hasOwnProperty('q')) search['highlight_fields'] = 'full_text_contents'

            sender.user.make_request(
                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    //console.log(data)
                    if (sender.has_props(data, ['meta.total', 'records'])) {
                        if (refresh_facets) total_results.html(data.meta.total)
                        let count_offset = (data.meta.page - 1) * data.meta.page_size

                        // setup result observer
                        if (sender.results_observer === null) {
                            sender.results_observer = new IntersectionObserver(function(entries) {
                                entries.map(entry => {
                                    if (entry.isIntersecting) {
                                        let result = jQuery(`#${entry.target.id}`)
                                        let result_id = result.data('id')

                                        // increment results scrolled, act accordingly
                                        sender.results_scrolled += 1
                                        if (sender.results_scrolled > 6 && sender.autocollapse_refinements) sender.refinements_box.prop('open', false)

                                        // update count
                                        let result_count = result.data('count')
                                        let current_result = jQuery(`#arc-fs-current-result-count`)
                                        current_result.html(result_count)
                                        current_result.data('id', result_id)

                                        if (!(result_id in sender.user.results_populated)) {
                                            sender.user.results_populated[result_id] = ArtifactStates.MetadataRendered
                                            sender.user.make_request(
                                                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/${result_id}/`,
                                                "GET",
                                                {},
                                                function (res) {
                                                    sender.user.render_artifact(result_id, res)
                                                }
                                            )
                                        } else {
                                            sender.user.inject_user_metadata(result_id)
                                        }
                                    }
                                })
                            })
                        }

                        // setup page observer
                        if (sender.page_observer === null) {
                            sender.page_observer = new IntersectionObserver(function (entries) {
                                entries.map(entry => {
                                    if (entry.isIntersecting) {
                                        let marker = jQuery(`#${entry.target.id}`)
                                        let traversed = marker.data('traversed') === 'yes'
                                        if (!traversed) {
                                            let next_page = parseInt(marker.data('next-page'))
                                            console.log(`loading page ${next_page} of results`)
                                            marker.data('traversed', 'yes')
                                            sender.search_params['page'] = next_page
                                            sender.populate_results(false)
                                        }
                                    }
                                })
                            })
                        }

                        // handle min and max year aggregations
                        if (sender.has_props(data, ['meta.aggregations.maxyear', 'meta.aggregations.minyear'])) {
                            let min_year = data.meta.aggregations.minyear
                            let max_year = data.meta.aggregations.maxyear
                            let range_start = min_year
                            let range_end = max_year
                            if (sender.search_params.hasOwnProperty('r_years')) {
                                [range_start, range_end] = sender.search_params['r_years'].split('to')
                            }
                            sender.configure_year_slider(min_year, max_year, range_start, range_end)
                        }

                        // iterate over results
                        data.records.map((res, count) => {
                            let excerpts = ""
                            if (sender.has_prop(res, '_search_highlights.full_text_contents')) {
                                let highlights = res._search_highlights.full_text_contents
                                if (highlights.length) {
                                    excerpts = `<dt>Excerpts:</dt><dd>${highlights.join(' ... ')}</dd>`
                                }
                            }

                            sender.results_box.append(`
                                <table id="${res.id}-container" class="arc-search-result" data-id="${res.id}" data-count="${count + count_offset + 1}">
                                    <tr>
                                        <td id="${res.id}-thumb-container" class="arc-search-result-thumb-container">
                                            <img id="${res.id}-thumb" class="arc-search-result-thumb" src="" data-src="" />
                                        </td>
                                        <td class="arc-search-result-details-container">
                                            <a id="${res.id}-title" href="#" target="_blank" class="arc-search-result-title"></a>
                                            <dl id="${res.id}-metadata" style="width: inherit; display: grid; grid-template-columns: 15% 85%;">
                                                ${excerpts}
                                            </dl>
                                        </td>
                                    </tr>
                                </table>
                            `)
                        })

                        jQuery('.arc-search-result').each(function() {
                            sender.results_observer.observe(this)
                        })

                        // add next page marker
                        if (data.meta.has_next_page) {
                            let current_page = data.meta.page
                            sender.results_box.append(`
                                <div id="page-${current_page}-marker" data-next-page="${current_page + 1}" data-traversed="no"></div>
                            `)
                            sender.page_observer.observe(jQuery(`#page-${current_page}-marker`)[0])
                        }
                    }
                }
            )
        } else {
            delete sender.search_params['q']
        }

        if (refresh_facets) {
            jQuery('.arc-facet').hide()
            jQuery('.archive-parent').hide().prop('open', false)
            jQuery('.facet-count').html('0')
            jQuery('.selected-facet').removeClass('selected-facet')

            // FEDERATIONS
            let search = Object.assign({}, sender.search_params)
            search['page-size'] = 0
            search['a_terms_federations'] = 'federations.id'
            delete search.page
            delete search['t_federations.id']

            this.user.make_request(
                `/api/corpus/${this.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    if (sender.has_prop(data, 'meta.aggregations.federations')) {
                        let fed_aggs = data.meta.aggregations.federations
                        for (let fed_id in fed_aggs) {
                            let fed_count = fed_aggs[fed_id]
                            let facet = jQuery(`#federation-facet-${fed_id}`)
                            if (facet.length) {
                                facet.show()
                                if (sender.facet_has_value('t_federations.id', fed_id))
                                    jQuery(`#federation-facet-${fed_id}-checkbox`).prop('checked', true)
                                jQuery(`#federation-facet-${fed_id}-count`).html(fed_count.toLocaleString('en-US'))
                            }
                        }
                    }
                }
            )

            // ARCHIVES
            search = Object.assign({}, sender.search_params)
            search['page-size'] = 0
            search['a_terms_archives'] = 'archive.id'
            delete search.page
            delete search['t_archive.id']

            sender.user.make_request(
                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    if (sender.has_prop(data, 'meta.aggregations.archives')) {
                        let visible_parents = []
                        let open_parents = []
                        let arch_aggs = data.meta.aggregations.archives
                        for (let arch_id in arch_aggs) {
                            let [facet, selected] = sender.display_facet(
                                arch_id,
                                'archive',
                                't_archive.id',
                                arch_aggs[arch_id]
                            )
                            if (facet.data('parent-path')) {
                                let parent_names = facet.data('parent-path').split('__')
                                visible_parents = visible_parents.concat(parent_names)
                                if (selected) open_parents = open_parents.concat(parent_names)
                            }
                            else console.log(`${arch_id} has no parent!`)
                        }
                        if (visible_parents.length) sender.adjust_archive_parents([...new Set(visible_parents)].reverse(), 'show')
                        if (open_parents.length) sender.adjust_archive_parents([...new Set(open_parents)].reverse(), 'open')
                    }
                }
            )

            // FORMAT
            search = Object.assign({}, sender.search_params)
            search['page-size'] = 0
            search['a_terms_formats'] = 'types.id'
            delete search.page
            delete search['t_types.id']

            this.user.make_request(
                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    if (sender.has_prop(data, 'meta.aggregations.formats')) {
                        let format_aggs = data.meta.aggregations.formats
                        for (let format_id in format_aggs) {
                            sender.display_facet(
                                format_id,
                                'format',
                                't_types.id',
                                format_aggs[format_id]
                            )
                        }
                    }
                }
            )

            // DISCIPLINE
            search = Object.assign({}, sender.search_params)
            search['page-size'] = 0
            search['a_terms_disciplines'] = 'disciplines.id'
            delete search.page
            delete search['t_disciplines.id']

            this.user.make_request(
                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    if (sender.has_prop(data, 'meta.aggregations.disciplines')) {
                        let disc_aggs = data.meta.aggregations.disciplines
                        for (let disc_id in disc_aggs) {
                            sender.display_facet(
                                disc_id,
                                'disc',
                                't_disciplines.id',
                                disc_aggs[disc_id]
                            )
                        }
                    }
                }
            )

            // GENRE
            search = Object.assign({}, sender.search_params)
            search['page-size'] = 0
            search['a_terms_genres'] = 'genres.id'
            delete search.page
            delete search['t_genres.id']

            this.user.make_request(
                `/api/corpus/${sender.user.corpus_id}/ArcArtifact/`,
                "GET",
                search,
                function (data) {
                    if (sender.has_prop(data, 'meta.aggregations.genres')) {
                        let genre_aggs = data.meta.aggregations.genres
                        for (let genre_id in genre_aggs) {
                            sender.display_facet(
                                genre_id,
                                'genre',
                                't_genres.id',
                                genre_aggs[genre_id]
                            )
                        }
                    }
                }
            )
        }
    }



    collect_result(result_id) {
        let sender = this
        if (sender.user.userid) {
            let result_container = jQuery(`#${result_id}-container`)
            let col_button = jQuery(`#${result_id}-collect-button`)
            let collection_modal = jQuery('#arc-user-collection-modal')
            let collection_id_param = jQuery('#arc-user-collection-artifact-id')

            if (!result_container.data('is_collected')) {
                collection_id_param.val(result_id)
                collection_modal.dialog('open')

                result_container.data('is_collected', 'true')
                col_button.html('Uncollect')
            } else {
                sender.user.make_request(
                    `/api/arc/user-collection/${sender.user.corpus_id}/`,
                    'POST',
                    {
                        'artifact-id': result_id.replace('my-', ''),
                        'delete': 'y'
                    },
                    function(data) {
                        if (data.message && data.message === "artifact uncollected successfully") {
                            result_container.data('is_collected', '')
                            col_button.html('Collect')
                        }
                    }
                )
            }
        }
    }

    show_search_params() {
        this.param_box.empty()
        if (this.has_query()) {
            this.param_box.show()
            this.param_box.append(`
                <span class="search-param">Showing <span id="arc-fs-current-result-count"></span> of <span id="arc-fs-total-result-count"> results</span>
            `)

            Object.keys(this.search_params).map(param => {
                if (!(param.startsWith('t_federations') || ['page', 'page-size', 'only', 'highlight_fields'].includes(param))) {
                    let val = this.search_params[param]

                    let p = `<span class="search-param">`

                    if (param === 'q')
                        p += `Searching for <b>${val}</b>
                            <span
                                class="dashicons dashicons-trash facet-indicator"
                                data-param="${param}"
                                data-action="delete"
                                data-tippy-content="Remove this criteria.">
                            </span>`
                    else {
                        let [method, field] = param.split('_')
                        let excluding = field.endsWith('-')

                        // function for building facet indicators
                        let build_facet_indicators = (facet_type) => {
                            let indicators = []
                            let vals = val.split('__')
                            vals.map(facet_id => {
                                let facet = jQuery(`#${facet_type}-facet-${facet_id}`)
                                if (facet.length) {
                                    indicators.push(`
                                        <b>${facet.data('name')}</b>
                                    `)
                                }
                            })
                            return indicators.join(' and ') + `
                                <span
                                    class="dashicons ${excluding ? 'dashicons-plus': 'dashicons-remove'} facet-indicator"
                                    data-param="${param}"
                                    data-action="${excluding ? 'include' : 'exclude'}"
                                    data-tippy-content="${excluding ? 'Include results matching this criteria.' : 'Exclude results matching this criteria.'}">
                                </span><span
                                    class="dashicons dashicons-trash facet-indicator"
                                    data-param="${param}"
                                    data-action="delete"
                                    data-tippy-content="Remove this criteria.">
                                </span>
                            `
                        }

                        if (['t', 'q', 'f'].includes(method)) {
                            let verb = "Filtering by"
                            if (field.endsWith('-'))
                                verb = "Excluding"

                            if (field.startsWith('archive'))
                                p += `${verb} archive ${build_facet_indicators('archive')}`
                            else if (field.startsWith('type'))
                                p += `${verb} format ${build_facet_indicators('format')}`
                            else if (field.startsWith('discipline'))
                                p += `${verb} discipline ${build_facet_indicators('disc')}`
                            else if (field.startsWith('genre'))
                                p += `${verb} genre ${build_facet_indicators('genre')}`
                            else if (field.startsWith('title'))
                                p += `${verb} title
                                    <b>${this.title_box.val()}</b>
                                    <span
                                        class="dashicons dashicons-trash facet-indicator"
                                        data-param="${param}"
                                        data-action="delete"
                                        data-tippy-content="Remove this criteria.">
                                    </span>
                                `
                            else if (field.startsWith('agents')) {
                                p += `${verb} person
                                    <b>${this.person_box.val()} (${this.user.role_mapping[this.role_box.val()]})</b>
                                    <span
                                        class="dashicons dashicons-trash facet-indicator"
                                        data-param="${param}"
                                        data-action="delete"
                                        data-tippy-content="Remove this criteria.">
                                    </span>
                                `
                            }
                        } else if (method === 'r') {
                            let date_range = this.search_params[param].split('to')
                            p += `Filtering by date range
                                    <b>${date_range[0]}-${date_range[1]}</b>
                                    <span
                                        class="dashicons dashicons-trash facet-indicator"
                                        data-param="${param}"
                                        data-action="delete"
                                        data-tippy-content="Remove this criteria.">
                                    </span>
                            `
                        }
                    }

                    p += '</span>'
                    this.param_box.append(p)
                }
            })

            this.param_box.append(`
                <span class="search-param"><a onclick="document.body.scrollTop = document.documentElement.scrollTop = 0;">Back to top</a></span>
            `)

            let sender = this
            let facet_indicators = jQuery('.facet-indicator')
            facet_indicators.on('click', function() {
                let indicator = jQuery(this)
                let param = indicator.data('param')
                let action = indicator.data('action')

                if (param === 'q') {
                    sender.query_box.val('')
                    delete sender.search_params['q']
                    sender.populate_results()
                } else if (param === 'r_years') {
                    delete sender.search_params['r_years']
                    sender.configure_year_slider()
                    sender.populate_results()
                } else if (param === 't_agents.id') {
                    delete sender.search_params['t_agents.id']
                    sender.person_box.val('')
                    sender.role_box.val('AUT')
                    sender.populate_results()
                } else {
                    if (action === 'delete') delete sender.search_params[param]
                    else {
                        let current_value = sender.search_params[param]
                        delete sender.search_params[param]

                        if (action === 'exclude') {
                            sender.search_params[param + '-'] = current_value
                        } else if (action === 'include') {
                            sender.search_params[param.replace('-', '')] = current_value
                        }
                    }
                    sender.populate_results()
                }
            })

            tippy('[data-tippy-content]', {
                placement: 'bottom'
            })
        }
        else {
            this.param_box.hide()
            this.results_box.empty()
            this.refinements_box.prop('open', false)
            this.help_box.show()
        }
    }

    adjust_archive_parents(names, adjustment) {
        names.map(name => {
            let parent_id = 'arc-fs-arch-' + name.replace(/ /g, '').replace(/,/g, '')
            let parent = jQuery(`#${parent_id}`)
            if (parent.length) {
                if (adjustment === 'show') {
                    parent.show()
                    let parent_count = 0
                    parent.find('.archive-count').each(function() {
                        parent_count += parseInt(jQuery(this).html().replace(/,/g, ''))
                    })
                    jQuery(`#${parent_id}-count`).html(parent_count.toLocaleString('en-US'))
                }
                else if (adjustment === 'open') parent.prop('open', true)
            }
        })
    }

    display_facet(facet_id, facet_type, facet_param, count) {
        let selected = false
        let facet_element_id = `#${facet_type}-facet-${facet_id}`
        let facet = jQuery(facet_element_id)
        let facet_count = jQuery(`${facet_element_id}-count`)

        if (facet.length && facet_count.length) {
            facet.show()
            if (this.facet_has_value(facet_param, facet_id)) {
                facet.addClass('selected-facet')
                selected = true
            }
            facet_count.html(count.toLocaleString('en-US'))
        }
        return [facet, selected]
    }

    toggle_facet(facet, value) {
        let facet_values = []

        if (this.search_params.hasOwnProperty(facet)) {
            facet_values = this.search_params[facet].split('__')
            if (facet_values.includes(value))
                facet_values = facet_values.filter(e => e !== value)
            else
                facet_values.push(value)
        } else {
            facet_values.push(value)
        }

        if (facet_values.length)
            this.search_params[facet] = facet_values.join('__')
        else
            delete this.search_params[facet]

        this.populate_results()
    }

    facet_has_value(facet, value) {
        let has_value = false
        if (this.search_params.hasOwnProperty(facet))
            if (this.search_params[facet].split('__').includes(value))
                has_value = true
        return has_value
    }

    get_facet_data(facet_id, facet_type, data) {
        let facet = jQuery(`#${facet_type}-${facet_id}`)
        return facet.length ? facet.data(data) : ''
    }

    configure_year_slider(min=400, max=2100, range_start=400, range_end=2100) {
        this.year_slider.slider('option', {
            min: min,
            max: max,
            values: [range_start, range_end]
        })
        this.year_indicator.val(`${range_start} - ${range_end}`)
    }

    refine_by_date_range() {
        let [min_year, max_year] = this.year_slider.slider("values")
        this.search_params['r_years'] = `${min_year}to${max_year}`
        this.populate_results()
    }

    get_url_param(param) {
        return this.url_params.get(param)
    }

    has_query() {
        let has = false
        Object.keys(this.search_params).map(param => {
            if (param === 'q') has = true
            else if (param.startsWith('t_') && !param.startsWith('t_federations')) has = true
            else if (param.startsWith('q_')) has = true
            else if (param.startsWith('w_')) has = true
            else if (param.startsWith('p_')) has = true
            else if (param.startsWith('r_')) has = true
        })
        return has
    }

    has_prop(obj, prop_path) {
        let props = prop_path.split('.')
        let curr_prop = props.shift()

        if (obj.hasOwnProperty(curr_prop)) {
            if (props.length)
                return this.has_prop(obj[curr_prop], props.join('.'))
            else
                return true
        } else {
            return false
        }
    }

    has_props(obj, prop_paths) {
        let has = true
        prop_paths.map(prop_path => { if (!this.has_prop(obj, prop_path)) has = false; })
        return has
    }

    get_obj_path(obj, path) {
        let result = obj
        if (this.has_prop(path)) {
            let strata = path.split('.')
            if (strata.length && strata[0]) {
                strata.map(stratum => {
                    result = obj[stratum]
                })
                return result
            } else
                return null
        } else {
            return null
        }
    }

    alphebatize_array_of_objs(obj, path) {
        let sender = this
        return obj.sort((a, b) => (sender.get_obj_path(a, path) > sender.get_obj_path(b, path)) ? 1 : -1)
    }
}
