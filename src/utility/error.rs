/*
 * @author: dwclake
 */

use crate::prelude::*;

/// Shared Error behavior which each part of the compiler provides an implementation for
pub trait Error {
    fn to_string(&self) -> String;
    fn position(&self) -> &Position;
    fn message(&self) -> &Box<str>;
    fn kind(&self) -> String;
}
