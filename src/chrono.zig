// @author: ruka-lang
// @created: 2024-09-13

//

const std = @import("std");

milliseconds: u16,
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
    .milliseconds = 0,
    .seconds = 0,
    .minutes = 0,
    .hours = 0,
    .days = 0,
    .months = 0,
    .years = 0,
    //.millisecond = ,
    //.second = ,
    //.minute = ,
    //.day = ,
    //.month = ,
    //.year = 1970,
    .timezone = .UTC
};

pub fn initEpoch() Chrono {
    return epoch_unix;
}

pub fn init(timezone: @TypeOf(Chrono.timezone)) Chrono {
    const time =std.time.milliTimestamp();

    var chrono = undefined;
    chrono.milliseconds = time;
    chrono.seconds = chrono.milliseconds / 1000;
    chrono.minutes = chrono.seconds / 60;
    chrono.hours = chrono.minutes / 60;
    chrono.days = chrono.hours / 24;
    //chrono.months
    //chrono.years
    chrono.timezone = timezone;

    return chrono;
}

pub fn deinit(self: Chrono) void {
    _ = self;
}

///
pub const Weekday = enum {
    monday,
    tuesday,
    wednesday,
    thursday,
    friday,
    saturday,
    sunday,

    pub fn toString(self: Weekday) []const u8 {
        return @tagName(self);
    }
};

///
pub const Month = enum {
    january,
    february,
    march,
    april,
    may,
    june, 
    july,
    august,
    september,
    october,
    november,
    december,

    pub fn toString(self: Month) []const u8 {
        return @tagName(self);
    }

    pub const daysPerMonth = std.StaticStringMap(usize).initComptime(.{
        .{"janurary", 31},
        .{"february", 28}, //29 on a leap year
        .{"march", 31},
        .{"april", 30},
        .{"may", 31},
        .{"june", 30},
        .{"july", 31},
        .{"august", 31},
        .{"september", 30},
        .{"october", 31},
        .{"november", 30},
        .{"december", 31}
    });
};

test "test chrono module" {
    _ = tests;
}

const tests = struct {
    const testing = std.testing;
    const allocator = testing.allocator;

    test "epoch initialization" {
        const chrono: Chrono = .epoch_unix;
        try testing.expect(chrono.timezone == .UTC);
    }
};
