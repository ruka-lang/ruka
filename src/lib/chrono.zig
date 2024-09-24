// @author: ruka-lang
// @created: 2024-09-13

///

const std = @import("std");

ms: u16,
seconds: u8,
minutes: u8,
hours: u8,
days: u8,
months: u8,
years: u16,
timezone: enum {
    CST,
    EST,
    PST,
    UTC,

    pub fn toString(self: @This()) []const u8 {
        return @tagName(self);
    }
},

const Chrono = @This();

///
pub const epoch_unix = Chrono {
    .ms = 0,
    .seconds = 0,
    .minutes = 0,
    .hours = 0,
    .days = 0,
    .months = 0,
    .years = 1970,
    .timezone = .UTC
};

pub fn initEpoch() Chrono {
    return epoch_unix;
}

pub fn init() Chrono {
    var time = epoch_unix;

    time.ms = std.time.milliTimestamp();

    return time;
}

pub fn deinit(self: Chrono) void {
    _ = self;
}

///
pub const Weekday = enum {
    Monday,
    Tuesday,
    Wednesday,
    Thursday,
    Friday,
    Saturday,
    Sunday,

    pub fn toString(self: Weekday) []const u8 {
        return @tagName(self);
    }
};

///
pub const Month = enum {
    January,
    February,
    March,
    April,
    May,
    June, 
    July,
    August,
    September,
    October,
    November,
    December,

    pub fn toString(self: Month) []const u8 {
        return @tagName(self);
    }
};
