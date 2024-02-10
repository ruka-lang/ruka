/*
 * @author: dwclake
 */

use const_format::formatcp;

pub const EXT: &str = "warp";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
pub const DESCRIPTION: &str = env!("CARGO_PKG_DESCRIPTION");
pub const ABOUT: &str = formatcp!("
warpc {VERSION}
{DESCRIPTION}");
