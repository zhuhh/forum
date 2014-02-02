module.exports = wrap;


var crypto = require("crypto"),
    createModel = require("model-brighthas"),
    is = require("istype"),
    attr = require("./plugin/attr");

function wrap(my) {


    var User = createModel("User");

    User.roles = {
        USER: 0,
        ADMIN: 1,
        MODERATOR: 2
    };

    User
        .attr("id")
        .attr("follows", {
            type: "array",
            default: []
        })
        .attr("watchers", {
            type: "array",
            default: []
        })
        .attr("nickname", {
			min:4,
			max:16,
            readonly: true
        })
		.attr("sex",{
			type:"boolean",
			default:true
		})
		.attr("address",{
			max:35
		})
		.attr("des",{
			max:200,
			default:""
		})
        .attr("role", {
            required: true,
            type: "number",
            default: User.roles.USER
        })
        .attr("password", {
            min: 6,
            max: 25,
            required: true
        })
        .attr("email", {
            min: 3,
            max: 30,
            required: true,
            readonly: true
        })
		// base64 image data  must < 150KB .
		.attr("logo")
        .attr("fraction", {
            default: 0,
            type: "number"
        })
        .attr("createTime", {
            type: "date"
        })
        .attr("reportTime", {
            type: "date"
        })
		.method("updateInfo",function(data){
			
			var self = this;
			
			if(is.type(data) === "object"){
				
				var attrs = ["nickname","address","des","sex"];
				
				var keys = Object.keys(data);
				keys = keys.filter(function(key){
					return attrs.indexOf(key) !== -1;
				});
				
				self.begin();
				keys.forEach(function(key){
					self[key] = data[key];
				})
				self.end();
				
			}else{
				this.error("updateInfo","error");
			}
			
			
			return this.errors;
		})
        .method("updatePassword", function(old, npass) {

            if (is.string(old) && is.string(npass)) {
                var md5 = crypto.createHash('md5');
                var old2 = md5.update(old).digest("hex");

                if (this.password === old2 && old !== npass) {
                    this.password = npass;
                } else {
                    this.error("password", "update error");
                }
            } else {
                this.error("password", "update error");
            }

            return this.errors;

        })
        .method("plus", function(num) {
            this.fraction = this.fraction + num;
            return this.errors;
        })
        .method("report", function() {
            var reportTime = this.reportTime;
            var nowTime = new Date();
            if ("" + reportTime.getFullYear() + reportTime.getMonth() + reportTime.getDate() !== "" + nowTime.getFullYear() + nowTime.getMonth() + nowTime.getDate()) {
                this.plus(2);
                this.reportTime = new Date();
            }
        })
        .method("follow", function(uid) {
            var self = this;

            my.repos.User.get(uid, function(err, user) {
                if (user) {

                    var follows = self.follows;

                    if (follows.indexOf(uid) === -1) {
                        follows.push(uid);
                        self.follows = follows;
                    }

                    var watchers = user.watchers;
                    if (watchers.indexOf(self.id) === -1) {
                        watchers.push(self.id);
                        user.watchers = watchers;
                    }

                }
            })
        })
        .method("unfollow", function(uid) {

            var self = this;

            my.repos.User.get(uid, function(err, user) {

                var follows = self.follows;

                var findex = follows.indexOf(uid);
                if (findex !== -1) {
                    follows.splice(findex, 1);
                    self.follows = follows;
                }

                if (user) {
                    var watchers = user.watchers;
                    var windex = watchers.indexOf(self.id);
                    if (windex !== -1) {
                        watchers.splice(windex, 1);
                        user.watchers = watchers;
                    }
                }
            })
        })
		
        .on("changed", function(u, attrs) {
			passTransform(u);
            my.publish("*.*.update", "User", u.id, this.toJSON(u, Object.keys(attrs)));
        })
        .validate(function(user, keys) {
            if (keys.indexOf("role") !== -1) {
                var role = user.attrs["role"];
                if ([0, 1, 2].indexOf(role) === -1) {
                    user.error("role", "no the role");
                }
            }
        })
		// logo validat
		//  image base64 must cut base64 type head
		.validate(function(user, keys){
			
			var keys = []
			
			if(keys.indexOf("logo") !== -1){
				
				var logo = user.attrs["logo"];
				if(is.string(logo) && logo.length > 0){
					var buf = new Buffer(logo,"base64")
					if(buf.length > 1024 * 150){
						user.error("logo","error");
					}
				}else{
					user.error("logo","error");
				}
				
			}
			
		})

    User.on("creating", function(user) {
        user.attrs.createTime = new Date();
        user.attrs.reportTime = new Date(0);
    })
	
	
	function passTransform(u){
        // password transform
        if (u.attrs.password) {
            var md5 = crypto.createHash('md5');
            u.oattrs.password = md5.update(u.oattrs.password).digest("hex");
        }
	}

    User.className = "User";

    return User;

}
