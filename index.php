<?php
/**
 * Plugin Name: Collex
 * Plugin URI: https://ar-c.org
 * Description: A plugin for enabling scholarly engagement with the ARC Catalog
 * Author: Bryan Tarpley
 * Author URI: https://codhr.tamu.edu
 * Version: 1.0.0
 * License: GPL2+
 * License URI: https://www.gnu.org/licenses/gpl-2.0.txt
 *
 * @package CGB
 */

// Exit if accessed directly.
	if (! defined( 'ABSPATH' ) ) 
	{
		exit;
	}

	wp_enqueue_style('dashicons');
	add_action('wp_enqueue_scripts','arc_corpora_enqueue_scripts');

	function arc_corpora_enqueue_scripts()
	{
		// Register Javascript
		wp_enqueue_script('jquery');
		wp_enqueue_script('jquery-ui-core');
		wp_enqueue_script('jquery-ui-slider');
		wp_enqueue_script('jquery-ui-dialog');
		wp_enqueue_script('collex-popper', plugin_dir_url(__FILE__).'js/popper.min.js');
		wp_enqueue_script('collex-tippy', plugin_dir_url(__FILE__).'js/tippy-bundle.umd.min.js', array('collex-popper'));
		wp_enqueue_script('collex-autocomplete', plugin_dir_url(__FILE__).'js/autoComplete.min.js');
		wp_enqueue_script(
		    'collex-script',
		    plugin_dir_url( __FILE__ ).'js/collex.js',
		    array(
		        'jquery',
		        'jquery-ui-core',
		        'jquery-ui-slider',
		        'jquery-ui-dialog',
		        'collex-popper',
		        'collex-tippy',
		        'collex-autocomplete'
            )
        ); //your javascript library

		// Register CSS
		wp_enqueue_style('jquery-ui-css', plugin_dir_url( __FILE__ ).'css/jquery-ui.min.css');
		wp_enqueue_style('collex-autocomplete-css', plugin_dir_url( __FILE__ ).'css/autoComplete.min.css');
		wp_enqueue_style('collex-css', plugin_dir_url( __FILE__ ).'css/collex.css');
	}

	function arc_corpora_inject_footer()
	{
	    $corpora_host = getenv('COLLEX_CORPORA_HOST');
	    $corpus_id = getenv('COLLEX_CORPUS_ID');
	    $federation_id = getenv('COLLEX_FEDERATION_ID');
	    $corpora_token = getenv('COLLEX_TOKEN');
	    $other_federation_ids = getenv('COLLEX_OTHER_FEDERATION_IDS');
	    $admin_post_url = esc_url( admin_url('admin-post.php') );
	    $arc_user_auth_token = '';
	    if (isset($_COOKIE['arc_user_auth_token'])) {
	        $arc_user_auth_token = $_COOKIE['arc_user_auth_token'];
	    }
?>
		<script>
		    let arc_user = null;
		    let collex = null;

			jQuery(document).ready(function($)
			{
			    arc_user = new ArcUser('<?=$corpora_host?>', '<?=$corpora_token?>', '<?=$arc_user_auth_token?>', '<?=$admin_post_url?>', '<?=$corpus_id?>', '<?=$federation_id?>');
				collex = new ArcFullSearch(arc_user, '<?=$other_federation_ids?>');
			});
		</script>	
<?php		
	}
	add_action('wp_footer', 'arc_corpora_inject_footer');

	function arc_corpora_login_user()
	{
	    // LOGIN
	    if (isset($_POST['arc_user_auth_token'])) {
            setcookie(
                'arc_user_auth_token',
                $_POST['arc_user_auth_token'],
                [
                    'expires' => time()+3600,
                    'path' => '/',
                    'samesite' => 'strict',
                ]
            );
            wp_send_json(['message' => 'arc user token stored'], 200);

        // LOGOUT
        } elseif (isset($_POST['arc_user_logout']) && isset($_COOKIE['arc_user_auth_token'])) {
            unset($_COOKIE['arc_user_auth_token']);
            setcookie('arc_user_auth_token', null, -1, '/');
            wp_send_json(['message' => 'arc user logged out'], 200);
        }
	}

	add_action('admin_post_nopriv_arc_user_login', 'arc_corpora_login_user');
	add_action('admin_post_arc_user_login', 'arc_corpora_login_user');
