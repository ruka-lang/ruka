/*
 * @author: dwclake
 */

use const_format::formatcp;

pub const EXT: &str = "ruka";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");
pub const ABOUT: &str = formatcp!("
rukac {VERSION}
{DESCRIPTION}");
